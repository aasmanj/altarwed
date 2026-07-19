# Design: Household Grouping in Guest List Management (#252)

Status: decision sheet for Jordan. Issue #252 stays open until the chosen option ships.

The guest list renders a flat table even at 300 guests. Households ("parties" in the code)
are already a first-class concept at RSVP time, in the Google Sheets sync, and in the data
model, but the management UI never groups by them. TheKnot and Zola both group by household
with collapse and an add-a-household flow; a couple managing ~90 households in a 300-row
wall is our biggest structural UX gap vs competitors (UX audit 2026-07-03, P1-3).

This doc maps what exists end to end with file:line citations, lays out three data-model
options, and recommends one. Line numbers are against `main` at commit `9180b68`.

## 1. Current-state map

### 1.1 Data model: the household concept already exists, denormalized on the guest row

There is no `households` table. Household identity lives in three columns added to
`guests` by `backend/src/main/resources/db/migration/V29__add_party_to_guests.sql:16-21`:

| Column | Type | Meaning |
|---|---|---|
| `party_id` | UNIQUEIDENTIFIER NULL | shared UUID for guests in the same household; NULL = solo |
| `party_name` | NVARCHAR(100) NULL | display name, denormalized onto every member row |
| `party_contact` | BIT NOT NULL DEFAULT 0 | documented as "exactly one guest per party is the contact who receives the invite email" |

A filtered index `IX_guests_party_id` (same file, lines 24-31) makes member lookup by
`party_id` cheap. The domain record carries the trio at
`backend/src/main/java/com/altarwed/domain/model/Guest.java:40-44`.

Identity semantics today:

- `GuestService.resolveParty` (`backend/src/main/java/com/altarwed/application/service/GuestService.java:1042-1052`)
  resolves a typed party name to an existing `party_id` by case-insensitive trimmed name
  match, scanning all of the couple's guests in memory, else mints a fresh UUID. So the
  UUID is the identity; the name is a per-row copy.
- `addGuest` (GuestService.java:122-141) and `updateGuest` (GuestService.java:276-302)
  both route through it. Update semantics: explicit `partyId` wins; blank `partyName`
  clears the party; a non-blank name joins the same-named party or starts a new one, and
  starting a new one makes the guest its contact.
- `createParty` (GuestService.java:151-172) creates a whole named household in one call,
  member index 0 becomes the contact. Exposed at
  `POST /api/v1/guests/couple/{coupleId}/party`
  (`backend/src/main/java/com/altarwed/web/controller/GuestController.java:125-133`).

Known integrity gaps of the denormalized shape:

- Name drift: renaming the party on one member (updateGuest with explicit `partyId` and a
  new `partyName`, GuestService.java:283-286) rewrites only that row; siblings keep the old
  string. There is no rename-household operation.
- Contact drift: nothing enforces "exactly one contact per party". `party_contact` is set
  on create paths but the only place it is ever read is a "(contact)" badge in the UI
  (`frontend-app/src/features/couple/guests/GuestListPage.tsx:932`). Invite sending does
  NOT consult it: `sendInvite` (GuestService.java:341-354) and the invite-all /
  bulk-invite paths (GuestService.java:538-576, 594-625) filter only on suppression and
  the `MAX_INVITE_SENDS = 3` cap (GuestService.java:52). A household of four with four
  emails gets four invite emails, contradicting the V29 contract comment.

### 1.2 RSVP flow: households are already a unit here

- Find-your-invitation: `GET /api/v1/guests/rsvp/find` (GuestController.java:172-186),
  `findGuestsByName` (GuestService.java:732), Turnstile-gated and throttled (issue #89),
  returns up to 5 masked names + tokens. Issue #415 (open) tracks that each returned token
  then discloses the full household via the page-data call below; any household redesign
  must not widen that surface.
- Page data: `getRsvpPageData` (GuestService.java:825; party branch 856-898) loads all
  members via `findAllByPartyId` for ANY member's token (not just the contact's) and
  returns them as `PartyMemberInfo`
  (`backend/src/main/java/com/altarwed/application/dto/PartyMemberInfo.java`) plus the
  `partyName`.
- Public page: greets the household by name
  (`frontend-public/src/app/rsvp/[token]/page.tsx:93-94`); the form renders per-member
  attending/declining toggles with per-member dietary and song fields
  (`frontend-public/src/app/rsvp/[token]/RsvpForm.tsx:489-530`) and submits them as
  `partyResponses` (RsvpForm.tsx:146-156).
- Submit: `submitRsvp` persists each member response after a cross-party tamper check
  (GuestService.java:945-960;
  `backend/src/main/java/com/altarwed/application/dto/PartyMemberResponse.java`).

One person can already RSVP for the whole household. Management UX is the missing half.

### 1.3 Google Sheets sync and CSV import/export: party column is authoritative

- Header aliases `party`, `party name`, `household`, `group`, `party / household`,
  `party/household`
  (`backend/src/main/java/com/altarwed/application/service/GoogleSheetSyncService.java:87-89`).
- The sheet is authoritative for grouping only when the column is present
  (GoogleSheetSyncService.java:440-445 and 675-678); without it, existing assignments are
  untouched.
- `computePartyAssignments` (GoogleSheetSyncService.java:1013-1053) reuses the couple's
  existing `party_id` for a name (stable identity across runs) and picks the contact as
  the first row with an email, else the first row.
- Dashboard CSV/XLSX import maps the same aliases
  (`frontend-app/src/features/couple/guests/guestImport.ts:38`, shipped via #223), and the
  export includes a `Party` column (GuestListPage.tsx:107; backend canonical export
  headers GuestService.java:187) so the file round-trips.

### 1.4 Seating: household-blind

Seats are `guests.table_number`, resolved positionally against `seating_tables` sorted by
`sort_order` (`backend/src/main/resources/db/migration/V19__create_seating_tables.sql`;
`backend/src/main/java/com/altarwed/application/service/SeatingTableService.java:67-76`).
`frontend-app/src/features/couple/seating/SeatingPage.tsx` and `SeatingBoardPage.tsx`
contain zero references to party: a household must be dragged to a table one member at a
time, and nothing warns when a household is split across tables.

### 1.5 Guest list management UI: where the flat table hurts

All in `frontend-app/src/features/couple/guests/GuestListPage.tsx` (the issue's cited
line numbers have drifted; these are current):

- Flat render: `filtered.map(guest => ...)` one `<tr>` per guest (845-896) under sortable
  Name/Email/Side/Status/Table headers (836-841). No grouping, no collapse, no per-household
  subtotals.
- Party is a caption: an italic `partyName` line under the guest name (934-935) plus the
  "(contact)" badge (932). At 300 guests a couple cannot see their ~90 households, count
  them, or act on one as a unit.
- Stale comment confirming the unbuilt plan: "Shared guest row (used inside both party
  blocks and solo blocks)" (908); party blocks were never built.
- Add-a-household has an API and a hook but no UI: `useCreateParty`
  (`frontend-app/src/features/couple/guests/useGuests.ts:268-273`) wraps the createParty
  endpoint and is consumed by no component. Couples simulate a household by typing the
  same free-text party name per guest (AddGuestForm field 1164-1168, EditGuestRow
  1274-1278), softened only by the #238 datalist of existing names
  (GuestListPage.tsx:1086-1101, `partyNames.ts`).
- Search does match party name (319) and stats
  (`guestStats.ts`) count guests, never households, so "how many invites am I sending"
  is unanswerable from the UI.

Summary: the backend is already household-shaped end to end (identity UUID, RSVP unit,
sheet sync unit). The flat table and the missing add-a-household UI are the gap.

## 2. Options

### Option A: promote the household to a first-class entity

New `households` table; guests reference it by FK; drop the denormalized name.

Additive migration sketch (two steps, both irreversible-forward per our Flyway rules):

```sql
-- VNN__create_households.sql
CREATE TABLE households (
    id         UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,  -- backfilled from guests.party_id
    couple_id  UNIQUEIDENTIFIER NOT NULL,
    name       NVARCHAR(100)    NOT NULL,
    contact_guest_id UNIQUEIDENTIFIER NULL,            -- nullable: contact optional
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_households_couple FOREIGN KEY (couple_id)
        REFERENCES couples(id) ON DELETE CASCADE
);
-- backfill one row per distinct guests.party_id (name = first non-null party_name,
-- contact = the party_contact=1 member if exactly one)
-- then: ALTER TABLE guests ADD CONSTRAINT fk_guests_household
--       FOREIGN KEY (party_id) REFERENCES households(id);
-- VNN+1 (later cleanup): drop guests.party_name, guests.party_contact
```

Blast radius:

- Backend: new domain record + port + JPA entity/repo/adapter; `Guest` record loses two
  fields (touches every 28-arg constructor call site: GuestService has 6+, sheet sync 2,
  adapters, tests); `resolveParty`, `createParty`, `updateGuest` rewritten against the
  repo; `getRsvpPageData` joins for the name; `computePartyAssignments` rewritten to
  upsert households; `GuestResponse`/`CreateGuestRequest`/`UpdateGuestRequest` DTOs
  reshaped; CSV export joins.
- Frontend: `useGuests.ts` types, GuestListPage, import mapping, RSVP page untouched at
  the API surface only if we keep response shapes compatible.
- FK ordering hazard: sheet sync deletes stale guests; contact_guest_id must be nulled or
  cascaded when the contact row is deleted.

Effects: RSVP find/page unchanged in behavior; invite caps unchanged; sheet sync logic
rewritten but same observable behavior; seating unchanged. Cleanest base for future
household-level features (one mailing address per household, invite-to-contact-only,
household notes).

Effort: 4 to 6 agent-days including migration testing against Testcontainers SQL Server,
plus real prod-data backfill risk. Highest chance of churning the guest-list core, which
is exactly what #252 parked the feature to avoid.

### Option B: keep the denormalized model, ship grouping UX plus two small backend patches

No new table. `party_id` stays the identity. Work is almost entirely in
`frontend-app/src/features/couple/guests/`:

- Grouped view in GuestListPage: group `filtered` by `partyId` (solo guests standalone),
  collapsible household header rows showing name, member count, RSVP rollup
  (3 attending / 1 pending), and the contact badge; expand to the existing `GuestRow`s.
  Default to grouped; clicking a column sort falls back to the flat sorted table (a
  grouped table cannot honor a global sort honestly).
- Add-a-household modal: wire the existing `useCreateParty` hook (useGuests.ts:268-273)
  to the existing `POST .../party` endpoint; name + N member name/email rows.
- Household count in the stats row and "N households" in the toolbar.
- Copy rename: "Party / household" becomes "Household" everywhere in the SPA. Backend
  field names, API JSON keys, and sheet header aliases stay as-is (aliases already accept
  "household").

Two small additive backend patches that fix real integrity gaps without touching the model:

- `PATCH /api/v1/guests/couple/{coupleId}/party/{partyId}` renaming `party_name` across
  all members atomically (closes the drift gap in 1.1); grouped UX makes rename a
  first-class gesture, so shipping grouping without it would surface the drift bug.
- Optional (question 5): make invite-all/bulk-invite send one email per household to the
  contact (or, safer default, leave sends per-guest and only surface the contact badge in
  the grouped header).

Migration sketch: none.

Effects: RSVP find/page/submit untouched; invite caps untouched unless question 5 says
otherwise; sheets sync untouched (same columns, same semantics); seating untouched
(follow-up candidate: household-aware seating chips).

Effort: 1.5 to 2.5 agent-days. Risk: party_name stays denormalized, so any future writer
that forgets the rename endpoint can still drift names; acceptable at current scale
(hundreds of guests per couple, resolveParty already scans in memory).

### Option C: hybrid, lightweight registry table behind the same API

Add a minimal `households(id, couple_id, name, contact_guest_id)` table as the
authoritative name registry keyed by the existing `party_id` values, keep
`guests.party_name` as a write-through denormalized copy for reads, and change no API
shapes. Fixes drift structurally while deferring the big refactor.

Blast radius: migration + backfill, new entity/repo, `resolveParty` and
`computePartyAssignments` write through the registry, rename endpoint updates registry
plus member rows. DTOs and frontends unchanged beyond Option B's UX work (which C still
needs on top).

Effort: Option B plus 1.5 to 2 agent-days, and the write-through copy adds a
two-writers consistency surface that needs its own tests. Middle risk, and it still does
not deliver any user-visible value beyond B.

## 3. Recommendation

Option B. The schema already gives us stable household identity (`party_id`), a complete
household RSVP flow, and sheet-sync grouping; the competitive gap #252 describes is purely
management UX, so B ships TheKnot/Zola parity in about 2 agent-days without churning
migrations, the sheets sync, or the RSVP core. Promote to a real entity (A) only when a
household-level feature that needs its own columns (per-household mailing address,
contact-only invites as a strict rule) actually gets scheduled; doing it now is shiny, not
load-bearing.

### Decision questions for Jordan (defaults applied if unanswered)

1. Data model: accept Option B (keep denormalized party fields, UX + rename endpoint
   only)? Default: yes, Option B.
2. Default presentation: grouped-by-household with collapsible sections as the default
   view, column-sort switching to the flat table, choice remembered in localStorage?
   Default: yes.
3. Add-a-household: dedicated "Add household" modal wired to the existing
   `POST .../party` endpoint and `useCreateParty` hook? Default: yes.
4. Copy: rename all SPA copy from "Party / household" to "Household" (API fields and
   sheet headers unchanged)? Default: yes.
5. Invite behavior: should invite-all/bulk-invite email only the household contact
   (enforcing the V29 contract), or keep per-guest sends? Default: keep per-guest sends
   for now (changing send semantics silently is riskier than the extra emails); file a
   separate issue for contact-only sends.

## 4. Acceptance criteria for the follow-up implementation issue (agent-ready)

Scope: `frontend-app/src/features/couple/guests/` plus one backend endpoint. No schema
changes. No changes to RSVP endpoints, sheets sync, or seating.

1. Grouped view. With guests loaded, GuestListPage groups members sharing a `partyId`
   under a collapsible household header row showing: household name, member count, RSVP
   rollup counts, and which member is the contact. Solo guests (`partyId === null`)
   render exactly as today. Empty list, loading, and error states unchanged.
2. Flat fallback. Activating any column sort renders the existing flat sorted table;
   clearing sort (or a "Group by household" toggle) returns to grouped view. The chosen
   mode persists per browser (localStorage) and defaults to grouped.
3. Filters and search operate on guests, and a household header renders whenever at least
   one member matches (non-matching members may stay hidden behind the collapse).
4. Add household. An "Add household" action opens a modal with household name plus 2 or
   more member rows (name required, email optional per existing CreateGuestRequest
   rules), submits via `useCreateParty`, and on success the new household appears grouped
   without a full page reload (cache update or refetch).
5. Rename household. New authenticated endpoint
   `PATCH /api/v1/guests/couple/{coupleId}/party/{partyId}` with body
   `{ "partyName": string (1..100) }` renames `party_name` on every member row in one
   transaction, 404s for a `partyId` not belonging to the couple, and is covered by a
   service test proving all members changed and a cross-couple test proving isolation.
   Grouped header exposes rename inline.
6. Existing behavior preserved (regression gates): per-guest edit still supports joining,
   starting, and clearing a party via free text with the #238 datalist; CSV import/export
   round-trip unchanged; RSVP invite send flows unchanged; `npx eslint src --ext ts,tsx
   --max-warnings=46` passes in `frontend-app`; existing vitest suites pass and new unit
   tests cover the grouping function (pure, extracted like `partyNames.ts`) including:
   members with same partyId group together, null partyId stays solo, rollup counts, and
   drifted party_name within one partyId (display the contact's name, do not split the
   group).
7. Accessibility: collapse toggles are buttons with `aria-expanded`, the grouped table
   remains navigable by keyboard, and headers announce member counts to screen readers.
8. Copy: SPA strings say "Household"; no em dashes introduced anywhere.

Out of scope (file separately if wanted): contact-only invite sends (question 5),
household-aware seating, promoting households to a table (Option A), any
`frontend-public` change.
