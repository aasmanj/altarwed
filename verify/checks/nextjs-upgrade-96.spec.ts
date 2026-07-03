import { test, expect } from '@playwright/test'
import { cfg } from '../config'

// Issue #96: Next.js 15.3.1 -> 15.5.20 in frontend-public, clearing HIGH security
// advisories on the internet-facing public site. Pure dependency bump, no product
// code changes -- this proves the public site still renders end-to-end after the
// bump: real SSR content, no hydration mismatches, client-side nav still works.

function collectConsoleIssues(page: import('@playwright/test').Page) {
  const issues: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') issues.push(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', (err) => issues.push(`[pageerror] ${err.message}`))
  return issues
}

// Only [error] and [pageerror] fail the check. [warning] is collected for the log
// but not asserted on: benign warnings (e.g. Next.js's own deprecation notices)
// would make this flaky if treated as a failure.
function hardFailures(issues: string[]) {
  return issues.filter((i) => i.startsWith('[error]') || i.startsWith('[pageerror]'))
}

test('wedding page renders real SSR content with no console errors', async ({ page }) => {
  const issues = collectConsoleIssues(page)

  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}`, { waitUntil: 'networkidle' })

  await expect(page.getByText(cfg.couple.partnerOneName, { exact: false }).first()).toBeVisible()
  await expect(page.getByText(cfg.couple.partnerTwoName, { exact: false }).first()).toBeVisible()

  const failures = hardFailures(issues)
  expect(failures, `console errors: ${failures.join('\n')}`).toEqual([])

  await page.screenshot({ path: 'evidence/nextjs-upgrade-wedding-page.png', fullPage: true })

  // probe: reload (cold SSR + fresh hydration) must not throw either.
  issues.length = 0
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByText(cfg.couple.partnerOneName, { exact: false }).first()).toBeVisible()
  const reloadFailures = hardFailures(issues)
  expect(reloadFailures, `console errors on reload: ${reloadFailures.join('\n')}`).toEqual([])

  console.log('WEDDING_PAGE_CONSOLE_ISSUES:', JSON.stringify(issues))
})

test('vendor directory renders with no console errors', async ({ page }) => {
  const issues = collectConsoleIssues(page)

  await page.goto(`${cfg.publicUrl}/vendors`, { waitUntil: 'networkidle' })
  await expect(page.locator('h1')).toBeVisible()

  const failures = hardFailures(issues)
  expect(failures, `console errors: ${failures.join('\n')}`).toEqual([])

  await page.screenshot({ path: 'evidence/nextjs-upgrade-vendors-page.png', fullPage: true })

  console.log('VENDORS_PAGE_CONSOLE_ISSUES:', JSON.stringify(issues))
})

test('homepage renders and client-side nav to vendors works', async ({ page }) => {
  const issues = collectConsoleIssues(page)

  await page.goto(cfg.publicUrl, { waitUntil: 'networkidle' })
  await expect(page.locator('h1').first()).toBeVisible()
  await page.screenshot({ path: 'evidence/nextjs-upgrade-homepage.png', fullPage: true })

  // probe: client-side transition via a real nav link, not a fresh page.goto.
  // This is exactly the kind of thing a Next.js router-internals bump can regress.
  const vendorsLink = page.getByRole('link', { name: /vendor/i }).first()
  if (await vendorsLink.count()) {
    await vendorsLink.click()
    await page.waitForURL(/\/vendors/, { timeout: 10_000 })
    await expect(page.locator('h1')).toBeVisible()
  }

  const failures = hardFailures(issues)
  expect(failures, `console errors: ${failures.join('\n')}`).toEqual([])

  console.log('HOMEPAGE_CONSOLE_ISSUES:', JSON.stringify(issues))
})
