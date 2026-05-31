import { Page, expect } from '@playwright/test'
import { cfg } from '../config'

/**
 * Logs the seeded test couple into the SPA by driving the REAL login form (the
 * app stores its refresh token in localStorage, so after this any page.goto to a
 * /dashboard route silently re-auths, no need to click through the app).
 */
export async function login(page: Page) {
  await page.goto(`${cfg.appUrl}/login`)
  await page.locator('input[type="email"]').fill(cfg.couple.email)
  await page.locator('input[type="password"]').fill(cfg.couple.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
}

export { cfg }
