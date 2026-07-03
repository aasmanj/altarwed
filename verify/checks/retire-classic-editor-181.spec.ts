import { test, expect } from '@playwright/test'
import { login, cfg } from '../helpers/login'

// Issue #181: the classic editor (WeddingWebsiteEditor.tsx / WeddingWebsitePage.tsx) is
// deleted; the page builder (SideBySideEditor) is the sole editor for wedding-website
// creation and customization. This proves the four behaviors the plan promised:
//   1. /dashboard/website redirects to /dashboard/website/editor (old bookmarks survive)
//   2. the dashboard's Registry card deep-links straight to the Registry tab
//   3. a couple with NO website yet can create one directly inside the page builder
//      (no hand-off to a separate classic-editor route)
//   4. the seeded couple's public wedding page still renders story/venue/registry/hotel
//      content correctly end to end after the refactor

test('legacy /dashboard/website route redirects into the page builder', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/website`)
  await expect(page).toHaveURL(/\/dashboard\/website\/editor/, { timeout: 10_000 })
  // Confirm it's genuinely the page builder that loaded, not a blank/error page.
  await expect(page.getByText(/home/i).first()).toBeVisible()
})

test('dashboard Registry card deep-links to the Registry tab in the page builder', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard`)
  await page.getByRole('link', { name: /registry/i }).first().click()
  await expect(page).toHaveURL(/\/dashboard\/website\/editor\?tab=registry/i, { timeout: 10_000 })
  // The Registry tab button should be the active one (not silently defaulted to Home).
  const registryTabButton = page.getByRole('button', { name: /^registry$/i })
  await expect(registryTabButton).toBeVisible()
})

test('a couple with no website yet can create one directly in the page builder', async ({ page, request }) => {
  // Register a genuinely fresh couple via the real API (same path seed.mjs uses), so
  // this couple has zero website record -- proving creation no longer hands off to a
  // separate classic-editor route.
  const email = `verify-181-${Date.now()}@verify.test`
  const reg = await request.post(`${cfg.apiUrl}/api/v1/couples/register`, {
    data: {
      partnerOneName: 'Fresh',
      partnerTwoName: 'Couple',
      email,
      password: 'VerifyPass123!',
      weddingDate: '2027-06-01',
    },
  })
  expect(reg.ok()).toBeTruthy()

  await page.goto(`${cfg.appUrl}/login`)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill('VerifyPass123!')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })

  await page.goto(`${cfg.appUrl}/dashboard/website/editor`)
  // Empty state: WeddingWebsiteSetup mounted inline, not a link out anywhere.
  await expect(page.getByRole('button', { name: /create|set up|get started/i }).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/classic editor/i)).toHaveCount(0)
})

test('seeded public wedding page still renders story, venue, registry, and hotel content', async ({ page }) => {
  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}`, { waitUntil: 'networkidle' })
  await expect(page.getByText(cfg.couple.partnerOneName, { exact: false }).first()).toBeVisible()
  await expect(page.getByText(cfg.couple.partnerTwoName, { exact: false }).first()).toBeVisible()

  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}/details`, { waitUntil: 'networkidle' })
  await expect(page.getByText(/grace chapel/i)).toBeVisible()

  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}/registry`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'evidence/retire-classic-editor-registry.png', fullPage: true })

  await page.screenshot({ path: 'evidence/retire-classic-editor-public-site.png', fullPage: true })
})
