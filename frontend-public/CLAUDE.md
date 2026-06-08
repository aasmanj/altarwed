
# Frontend Public, AltarWed (Next.js 14 SSR)

## Purpose
Public-facing SEO site. Every page server-side rendered (App Router, SSR/ISR). Couples and
vendors discover AltarWed here via Google. This is the surface a plaintiff's a11y scanner and
Google's crawler actually hit, so SEO and accessibility rules below are load-bearing here.

## Quick Start
- Dev: `npm run dev` (port 3000)
- Build: `npm run build`
- Lint: `npm run lint` (runs `eslint-plugin-jsx-a11y` -- fix all a11y errors before pushing)
- API base URL from `NEXT_PUBLIC_API_URL`.

> Pushing changes here triggers a `/verify` reminder in the pre-push hook. Run `/verify` to
> confirm the page actually renders in a browser before pushing.

## What's Live (shipped)

### Public pages
- `/` -- Homepage (target keyword: christian wedding planning)
- `/wedding/[slug]` -- Couple's public wedding website; ISR revalidate 60s
- `/wedding/[slug]/rsvp` -- Public RSVP page (find invitation by name, submit RSVP)
- `/vendors` -- Vendor directory with city + category filters
- `/vendors/[id]` -- Individual vendor listing page
- `/blog` -- Blog index; `/blog/[slug]` -- post (Article JSON-LD); 7 posts seeded
- `/resources` -- Affiliate resources page
- `/privacy`, `/terms` -- Legal pages
- `/sitemap.xml` -- Dynamic sitemap from DB

### Preview (internal)
- `/preview/[slug]/[tab]` -- Block editor preview iframe (no site chrome); used by `frontend-app`.
  Tab param is lowercased in URL, uppercased server-side.

## SEO Rules
- ALL public pages MUST be server-side rendered (SSR/SSG). URLs are lowercase, hyphenated,
  keyword-rich.
- Every page needs: `<title>` with primary keyword, `<meta name="description">` (<155 chars),
  Open Graph (`og:*`) tags, a canonical URL, and JSON-LD schema appropriate to the page type
  (Article for blog, LocalBusiness for vendor pages).
- Image `alt` text with descriptive keywords.
- Dynamic sitemap generated from DB at `/sitemap.xml`.

### ISR revalidate values
- Wedding pages: **60s**
- Vendor pages: **15s** (new vendors appear quickly)
- Prayer / guest data: **30s**
- Blog posts: should be **3600s** (currently 60s -- known minor issue, not urgent)

## Key Conventions
- **Date parsing:** use `formatWeddingDate` / `daysUntilDate` from `src/lib/date.ts` -- never
  `new Date(dateString)` directly (timezone off-by-one with `YYYY-MM-DD` strings; helpers parse
  as local noon).
- **Vendor logo:** show `<img>` when `logoUrl` is present, fall back to letter initial avatar.
- **RSVP "find invitation":** `FindInvitationWidget` in `src/app/wedding/[slug]/rsvp/` -- calls
  `GET /api/v1/guests/rsvp/find?slug={slug}&name={name}`, returns masked name + token.

## Accessibility Rules (WCAG 2.1 AA baseline, lawsuit prevention)

US courts apply ADA Title III by analogy; plaintiffs' firms cite WCAG 2.1 AA. Drive-by
lawsuits target **obvious** failures: no alt text, no labels, no keyboard nav, no contrast.
Run `npm run lint` (catches jsx-a11y) before every public-page push, and for a major launch
Tab through the page top-to-bottom and run it through https://wave.webaim.org/.

### 1. Images
- Every `<img>`/`<Image>` needs `alt`. Descriptive for content (`alt="Bride and groom
  exchanging rings at the altar"`), empty string for decorative (`alt=""`), never omit it.
- Couple-uploaded photos: use the field they provide (caption, member name) or a sensible
  fallback ("Wedding photo"). Never `alt="image"`/`alt="photo"` -- worse than nothing.

### 2. Forms
- Every `<input>`/`<textarea>`/`<select>` needs a programmatic label (`<label>`, `htmlFor`/`id`,
  or `aria-label`/`aria-labelledby`). **Placeholders are NOT labels.**
- Required fields use the `required` attribute, not just an asterisk.
- Error messages associated via `aria-describedby` and announced (`role="alert"` on the error container).

### 3. Color contrast
- Body text: WCAG AA -- 4.5:1 normal, 3:1 large (18pt+ or 14pt+ bold). The brown-light/cream
  palette is borderline; check new combinations at webaim.org/resources/contrastchecker.
- Never use color as the only signal (pair red error text with an icon and/or "Error:").

### 4. Keyboard navigation
- Every interactive element reachable by Tab, operable by Enter/Space. Don't put `onClick` on a
  `<div>` -- use `<button>` (gets keyboard, focus, screen reader free).
- Visible focus indicator on every focusable element. `focus:outline-none` (Tailwind's common
  offender) must be paired with `focus-visible:ring-2 focus-visible:ring-gold` or equivalent.
- Modals trap focus, return focus to the trigger on close, close on Escape.
- Custom widgets need ARIA (`role`, `aria-*` state, keyboard handlers); see `SideBySideEditor.tsx`.

### 5. Semantic HTML and headings
- One `<h1>` per page; headings step down without skipping (h1 -> h2 -> h3).
- Use `<nav>`/`<main>`/`<header>`/`<footer>`/`<article>`/`<section>` for landmarks; lists are
  `<ul>`/`<ol>`/`<li>`. Links go somewhere (`<a href>`); buttons do something (`<button onClick>`).

### 6. Dynamic content and ARIA
- Toasts, validation errors, auto-appearing content go in a live region (`role="status"`
  non-urgent, `role="alert"` urgent).
- Don't sprinkle ARIA "to be safe" -- wrong ARIA is worse than none. Use native elements first;
  ARIA only where native HTML can't express it (the SideBySideEditor divider needed
  `role="separator"`).
- Loading states need `aria-busy="true"` on the container, not just a spinner.

### 7. Media
- Future video needs captions; audio-only needs a transcript. Avoid autoplay; if unavoidable,
  provide a pause control and don't play audio.

### 8. Anti-patterns the reviewer flags
`<div onClick>` without role + tabIndex + keyboard handler; `<img>` without `alt`; input without
a label; `focus:outline-none` without a replacement indicator; placeholder as the only label;
`<a>` used as a button (or vice versa); color-only error/success; modal without focus trap or
Escape-to-close.
