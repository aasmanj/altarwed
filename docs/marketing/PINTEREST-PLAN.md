# AltarWed Pinterest Marketing Plan

Why Pinterest first: it is the single highest-intent visual channel for wedding planning
(roughly 8 in 10 engaged users on Pinterest plan their wedding there), pins have a shelf
life of months instead of hours, and every pin is a permanent backlink-style referral to
altarwed.com. For a solo founder with zero ad budget, Pinterest compounds; Instagram does not.

Goal hierarchy (in order): couples creating free wedding websites, blog traffic that
converts to couples, then vendor discovery later. Do not market to vendors on Pinterest yet.

## 1. Account setup (one-time, ~30 minutes)

1. Create a Pinterest BUSINESS account (free) named "AltarWed | Christian Wedding Planning".
2. Claim the altarwed.com domain (Settings, Claimed accounts; requires adding an HTML tag
   to the site head or a DNS TXT record; the DNS route through Cloudflare is cleanest).
   Claiming attributes every pin of our content to the account and unlocks analytics.
3. Enable Rich Pins (they auto-pull title/description from our Open Graph tags, which every
   page already has per the SEO rules). Validate one blog URL in the Rich Pins validator.
4. Profile: warm one-sentence bio with the keyword "Christian wedding planning", link to
   https://www.altarwed.com, the AltarWed logo as avatar.

## 2. Boards to create (10 to start)

Board names are search terms; Pinterest is a search engine, not a social feed. Each board
gets a 2-3 sentence keyword-rich description.

| Board | Anchor keyword | Seeded from |
|---|---|---|
| Christian Wedding Planning | christian wedding planning | checklist post + homepage |
| Bible Verses for Weddings | bible verses for weddings | verses post (highest-volume evergreen) |
| Christian Wedding Vows | christian wedding vows | vows post |
| Christian Wedding Ceremony | wedding ceremony order christian | ceremony-order + program-wording + officiant posts |
| Wedding Website Ideas | wedding website ideas | christian-wedding-website post + live couple sites |
| Christian Wedding Songs and Music | christian wedding songs | songs post |
| Unity Ceremony Ideas | unity ceremony ideas christian | unity post |
| Wedding Guest Outfits and Dress Codes | wedding dress code | dress-code post (broad, non-faith traffic feeder) |
| Faith-Filled Wedding Details | christian wedding decor scripture signs | curated repins + our images |
| Real AltarWed Weddings | christian wedding website examples | eden-faith-and-jordan + future couple sites |

The last two boards mix our pins with curated repins of others' content (aim 60/40 ours
to repins overall); an account that only self-promotes grows slower.

## 3. Pin content engine (what to actually post)

Every blog post becomes 3 to 5 pins, not one. Same destination URL, different images and
titles, published weeks apart. With 10 live posts that is a 30-50 pin runway before any
new content is needed.

Pin formats that fit what we already have:
1. Text-overlay idea pins: a serif headline on a soft photo or cream background
   ("50 Bible Verses for Your Wedding Ceremony", "Christian Wedding Ceremony Order,
   Step by Step"). These are list-post traffic magnets.
2. Checklist/template pins: a visual crop of the planning checklist or program wording
   with "get the full checklist" framing.
3. Real-wedding pins: screenshots and photos from the eden-faith-and-jordan site pinned to
   Real AltarWed Weddings, linking to the live wedding page. This is the viral loop seed:
   every future couple's site is pinnable inventory, and the wedding pages already ship a
   "Save to Pinterest" button (PR #431).
4. Quote pins: a single scripture verse beautifully typeset, linking to the verses post.
   Cheap to produce in bulk, extremely repinnable in this niche.

Production: Canva free tier, 1000x1500px (2:3 ratio, non-negotiable on Pinterest), a
consistent template family using the site palette (cream #fdfaf6, brown #3b2f2f, gold
#d4af6a) and the serif display font so pins are recognizably AltarWed. Batch one hour
per week producing 5-10 pins.

Pin SEO on every pin: keyword in the pin title (first 40 chars matter), a 1-2 sentence
description with one long-tail keyword written like a human sentence, and the destination
URL always the canonical https://www.altarwed.com/... page.

## 4. Cadence and first 30 days

Pinterest rewards consistency over volume. 1-2 pins per DAY beats 10 pins one Saturday.

- Week 1: account setup, 10 boards, 15 seed pins (one per board plus extras on the two
  biggest posts: bible verses, ceremony order). Repin 10-15 quality third-party pins so
  boards do not look empty.
- Weeks 2-4: 1-2 pins/day from the runway (use Pinterest's native scheduler, free, up to
  2 weeks ahead; batch the scheduling in one weekly sitting). Join 2-3 relevant group
  boards if invites are attainable, but do not chase them hard; they matter less now.
- Monthly: every new blog post (the biweekly drafter routine keeps producing) immediately
  gets its 3-5 pin set; every new published couple site gets asked/prompted to share via
  the on-page Pinterest button.

## 5. Measurement (monthly, 15 minutes)

- Pinterest Analytics: impressions, saves, outbound clicks per pin; double down on the
  format that wins (in this niche, expect verse quote pins and checklist pins to lead).
- PostHog/App Insights: sessions with utm_source=pinterest (add ?utm_source=pinterest
  &utm_medium=pin&utm_campaign=<board> to every pin URL; the admin funnel already tracks
  UTM attribution per AdminMetricsService).
- North star: couples who registered with a pinterest UTM. Everything else is vanity.

## 6. Product hooks that feed the loop (already live or queued)

- The public wedding page Pinterest save button (PR #431, merged) sits beside the
  "create your free site" CTA: guests save couple pages, their followers see AltarWed.
- og:image on every page (weekly monitor now checks it) is what Pinterest renders when
  someone saves a page without a custom pin; hero photos make good default pins.
- Future (worth an issue when Pinterest shows traction): auto-generate a branded
  1000x1500 "pin card" image per wedding site and per blog post, so one-click saves
  always produce a designed pin instead of a raw photo crop.

## 7. About automating via a Pinterest MCP server

There is no Pinterest connector attached to this Claude environment today, so nothing can
post to the account programmatically from here. Options, in order of practicality:
1. Manual with native scheduler (recommended to start): the volume above is under an hour
   a week; automation before product-market fit on the channel is premature.
2. Check claude.ai/customize/connectors for a Pinterest MCP connector; if one exists and
   is connected, future Claude sessions and scheduled routines can draft and queue pins.
3. Pinterest's official API requires an approved developer app (trial access is limited);
   a custom MCP server over it is a weekend project, sensible only once pins are proven
   to convert and volume exceeds ~20 pins/week.
