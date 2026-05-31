import { test, expect } from '@playwright/test'
import { login, cfg } from '../helpers/login'

// Baseline: the seeded couple can log in and the dashboard renders. If this
// fails, nothing else will, so run it first.
test('couple logs in and dashboard loads', async ({ page }) => {
  await login(page)
  await expect(page.getByText(/welcome back/i)).toBeVisible()
  await page.screenshot({ path: 'evidence/dashboard.png', fullPage: true })
})

test.afterAll(() => {
  console.log(`\nSeeded couple: ${cfg.couple.email} / ${cfg.couple.password}`)
})
