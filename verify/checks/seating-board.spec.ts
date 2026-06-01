import { test, expect } from '@playwright/test'
import { login, cfg } from '../helpers/login'

// Verifies the new printable seating board (/dashboard/seating/board): seated
// guests appear, alphabetically, mapped to their table.
test('seating board renders seated guests mapped to tables', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/seating/board`)

  await expect(page.getByText(/Please Find Your Seat/i)).toBeVisible()
  // Seeded, seated guests. .first() because each guest legitimately appears
  // twice: once in the alphabetical "find your seat" list and once in the
  // "by table" section (that duplication is the feature, not a bug).
  await expect(page.getByText('Andrew Carter').first()).toBeVisible()
  await expect(page.getByText('Bethany Cole').first()).toBeVisible()
  // Their table labels.
  await expect(page.getByText('Family Table').first()).toBeVisible()
  await expect(page.getByText('College Friends').first()).toBeVisible()

  await page.screenshot({ path: 'evidence/seating-board.png', fullPage: true })
})
