
# Frontend Public — AltarWed (Next.js SSR)

## Purpose
Public-facing SEO site. Every page server-side rendered.
Couples and vendors discover AltarWed here via Google.

## Quick Start
- Dev: npm run dev (port 3000)
- Build: npm run build
- Lint: npm run lint

## Key Pages to Build
- / → Homepage (target keyword: christian wedding planning)
- /vendors/[city]/[category] → Vendor directory (local SEO)
- /ceremony-templates/[denomination] → Denomination ceremony guides
- /blog/[slug] → Content marketing (bible verses, vow templates)
- /bible-verses-for-weddings → Flagship SEO page (40K searches/mo)
- /christian-wedding-vows → Second flagship (18K searches/mo)

## SEO Requirements on Every Page
- <title> tag with primary keyword
- <meta name="description"> under 155 chars
- <meta property="og:*"> for social sharing
- JSON-LD schema appropriate to page type
- Image alt text with descriptive keywords
- Canonical URL

## API
Calls altarwed backend at NEXT_PUBLIC_API_URL env variable.
