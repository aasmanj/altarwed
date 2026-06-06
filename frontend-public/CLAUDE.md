
# Frontend Public, AltarWed (Next.js SSR)

## Purpose
Public-facing SEO site. Every page server-side rendered (Next.js App Router, SSR/ISR).
Couples and vendors discover AltarWed here via Google.

## Quick Start
- Dev: `npm run dev` (port 3000)
- Build: `npm run build`
- Lint: `npm run lint` (runs eslint-plugin-jsx-a11y — fix all a11y errors before pushing)

## API
- Base URL from `NEXT_PUBLIC_API_URL` env variable

## What's Live (shipped)

### Public pages
- `/` — Homepage (target keyword: christian wedding planning)
- `/wedding/[slug]` — Couple's public wedding website; ISR revalidate 60s
- `/wedding/[slug]/rsvp` — Public RSVP page (find invitation by name, submit RSVP)
- `/vendors` — Vendor directory with city + category filters
- `/vendors/[id]` — Individual vendor listing page
- `/blog` — Blog index
- `/blog/[slug]` — Individual blog post (Article JSON-LD); 7 posts seeded
- `/resources` — Affiliate resources page
- `/privacy`, `/terms` — Legal pages
- `/sitemap.xml` — Dynamic sitemap from DB

### Preview (internal)
- `/preview/[slug]/[tab]` — Block editor preview iframe (no site chrome); used by `frontend-app`

## SEO Requirements on Every Page
- `<title>` with primary keyword
- `<meta name="description">` under 155 chars
- `<meta property="og:*">` for social sharing
- JSON-LD schema appropriate to page type (Article for blog, LocalBusiness for vendors)
- Image `alt` text with descriptive keywords
- Canonical URL

## ISR Revalidate Values
- Wedding pages: 60s
- Vendor pages: 15s (new vendors appear quickly)
- Prayer/guest data: 30s
- Blog posts: should be 3600s (currently 60s — known minor issue, not urgent)

## Key Conventions
- Date parsing: use `formatWeddingDate` / `daysUntilDate` from `src/lib/date.ts` — never
  `new Date(dateString)` directly (timezone off-by-one with YYYY-MM-DD strings)
- Vendor logo: show `<img>` when `logoUrl` is present, fall back to letter initial in avatar
- RSVP "find invitation": `FindInvitationWidget` in `src/app/wedding/[slug]/rsvp/` — calls
  `GET /api/v1/guests/rsvp/find?slug={slug}&name={name}`, returns masked name + token

## Accessibility (run before every push to public pages)
- `npm run lint` catches jsx-a11y violations automatically
- Every `<img>` needs descriptive `alt`; decorative images use `alt=""`
- Every form input needs a programmatic label (not just a placeholder)
- `focus:outline-none` must be paired with `focus-visible:ring-*`
- Modals must trap focus + close on Escape
- `<button>` for actions, `<a href>` for navigation — never swap these
