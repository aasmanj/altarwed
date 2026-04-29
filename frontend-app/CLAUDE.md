
# Frontend App — AltarWed Dashboard (React + Vite)

## Purpose  
Authenticated SPA for couples and vendors.
SEO does not matter here — this is behind login.

## Quick Start
- Dev: npm run dev (port 5173)
- Build: npm run build
- Test: npm run test

## Key Features to Build
- Couple dashboard: wedding overview, checklist, countdown
- Guest list manager: add/edit guests, track RSVPs
- Ceremony builder: scripture selection, vow editor, order of service
- Vendor dashboard: listing management, inquiry inbox, analytics
- Subscription management: Stripe portal integration

## Auth
- JWT stored in memory (not localStorage — XSS risk)
- Refresh token in httpOnly cookie
- React context for auth state
- Protected route component wrapping all dashboard routes

## API
Calls altarwed backend at VITE_API_URL env variable.
Use React Query for all server state.
Never use useEffect to fetch data — use React Query.
