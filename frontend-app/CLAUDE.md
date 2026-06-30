
# Frontend App, AltarWed Dashboard (React + Vite)

## Purpose
Authenticated SPA for couples and vendors. SEO does not matter here — everything is behind login.

## Quick Start
- Dev: `npm run dev` (port 5173)
- Build: `npm run build`
- Test: `npm run test`

## Auth
- JWT stored in memory (not localStorage — XSS risk)
- Refresh token in httpOnly cookie
- React context for auth state (`AuthContext`)
- `ProtectedRoute` wraps all dashboard routes; `role` prop enforces COUPLE vs VENDOR

## API
- Base URL from `VITE_API_URL` env variable
- Use React Query for all server state — never `useEffect` to fetch
- All mutations call `queryClient.invalidateQueries` on success to keep cache fresh

## What's Live (shipped)

### Couple dashboard
- Wedding overview with countdown
- Side-by-side block editor (14 block types; block preview via iframe to `frontend-public/preview/[slug]/[tab]`)
- Guest list: add/edit/delete, party grouping, invite send with cap tracking, RSVP status
- Seating chart: drag-drop table assignment
- Budget tracker: CRUD, estimated vs actual, paid flag
- Planning checklist: seeded + custom tasks
- Wedding party: members with roles, side, photo upload
- Photo album: upload + reorder
- Vow builder + ceremony order editor
- Scripture browser (modal; selected verse locked from manual edit)
- Hotel blocks: multiple hotel entries
- Google Sheets guest sync: connect sheet, 15-min auto-poll
- Account settings: read-only account info, password reset via emailed link (reuses the
  forgot-password flow), delete account. Names/email are not editable in-app yet.

### Vendor dashboard
- Listing management: bio, description, phone, website URL, price tier, denomination tags
- Logo upload (JPEG/PNG/WebP, 15 MB limit; stored in Azure Blob)
- Inquiry inbox: list with unread badge, mark-read
- Dashboard overview card with unread inquiry count

## What's Live (Phase 8, Stripe billing)
- **Vendor subscription billing**: Stripe Checkout to start a subscription and the Stripe
  Customer Portal for self-serve plan changes/cancellation. Vendor tiers only (couples are
  free). Backend is webhook-verified and idempotent.

## What's Next
- Reliability/security hardening backlog (GitHub issues #89-#118 from the 2026-06-29 audit)
  before the marketing push. Frontend P0/P1s: #90 (page-builder blocks must render on the live
  public site), #92 (album upload error handling), #93 (unify upload size limit + error
  surfacing), #94 (share moment on publish).

## Key Conventions
- Date parsing: use `formatWeddingDate` / `daysUntilDate` from `src/lib/date.ts` — never
  `new Date(dateString)` directly (timezone off-by-one with YYYY-MM-DD strings)
- File uploads: POST as `multipart/form-data`; all media goes through backend upload endpoints
- Invite cap: `MAX_INVITE_SENDS = 3`; frontend shows "Max sent" badge when `inviteSendCount >= 3`
- Boxed nulls: backend DTOs use `Boolean`/`Integer`; treat `null` as "not set", not false/0

## Accessibility
No eslint config here yet (relies on manual review). Lower legal risk than `frontend-public`
since everything is behind auth, but UX still matters. The full WCAG checklist lives in
`frontend-public/CLAUDE.md` -- apply the same patterns: `<button>` for actions / `<a href>` for
nav, programmatic labels on every input, `alt` on every image, `focus:outline-none` always
paired with a `focus-visible:ring-*`, modals trap focus + close on Escape.
