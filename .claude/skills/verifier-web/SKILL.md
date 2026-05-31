---
name: verifier-web
description: Browser-based verification for AltarWed GUI changes (the React SPA couple dashboard and the Next.js public site). Drives the running app with Playwright, logs in as the seeded test couple, exercises the changed screen, and captures screenshots as replayable evidence. Use when a change touches frontend-app or frontend-public and you need to confirm it in a real browser.
---

# verifier-web

Evidence-capture protocol for GUI changes. Drives the **running** app (not unit
tests) and saves screenshots so a reviewer can replay what was seen.

## Setup (once)
```bash
cd verify
npm install
npx playwright install chromium
```

## Preconditions
The stack must be up and seeded, use the **run-altarwed** skill first:
- backend on :8080 (Testcontainers), seeded (`node verify/seed.mjs`)
- SPA on :5173, public site on :3000 (only needed for public-site checks)

## Run the bundled checks
These cover the current regression surface and write evidence to `verify/evidence/`:
```bash
cd verify && npm test            # headless
cd verify && npm run test:headed # watch it drive the browser
```
- `smoke.spec.ts` — login + dashboard renders
- `confirm-dialog.spec.ts` — destructive action shows the custom `role=alertdialog`
  dialog, never a native `confirm()`; Escape cancels
- `seating-board.spec.ts` — printable board maps seated guests to tables
- `preview-placeholder.spec.ts` — empty registry card shows a placeholder in the
  editor preview but not on the live public page

HTML report (incl. failure traces): `cd verify && npm run report`.

## Writing a check for the change you're verifying
Drop a `*.spec.ts` in `verify/checks/`. Use the login helper, then drive the
exact screen the diff touches and screenshot it:
```ts
import { test, expect } from '@playwright/test'
import { login, cfg } from '../helpers/login'

test('my change', async ({ page }) => {
  await login(page)                                   // seeded couple, real form
  await page.goto(`${cfg.appUrl}/dashboard/<screen>`) // localStorage refresh re-auths on reload
  // ...drive the changed control...
  await expect(/* the observable result */).toBeVisible()
  await page.screenshot({ path: 'evidence/<change>.png', fullPage: true })
})
```

## Probe, don't just confirm
After the happy path, push on the change at the same surface: Escape/backdrop on a
modal, double-click a submit, an empty/over-long input, resize. One `🔍` probe per
change minimum. Capture what you see.

## Reporting
Report inline per the `/verify` format: verdict, steps (each = one action on the
running app + what you observed), and the key screenshot path from
`verify/evidence/`. The screenshot is the evidence, not your memory.

## Notes
- Auth: the SPA keeps its access token in memory and the refresh token in
  localStorage, so after `login()` a full `page.goto` to any dashboard route
  silently re-auths. No need to click through the app.
- Selectors here target visible text/roles (e.g. the guest "Remove" button). If
  the UI copy changes, update the spec, don't loosen it into a tautology.
- Destructive seeded data: the confirm-dialog check cancels (Escape) so it does
  not actually delete a guest. If a check must delete, re-run `seed.mjs` after.
