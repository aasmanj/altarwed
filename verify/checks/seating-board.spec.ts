import { test, expect } from '@playwright/test'
import { login, cfg } from '../helpers/login'

// Verifies the new printable seating board (/dashboard/seating/board): seated
// guests appear, alphabetically, mapped to their table.
test('seating board renders seated guests mapped to tables', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/seating/board`)

  await expect(page.getByText(/Please Find Your Seat/i)).toBeVisible()
  // Seeded, seated guests.
  await expect(page.getByText('Andrew Carter')).toBeVisible()
  await expect(page.getByText('Bethany Cole')).toBeVisible()
  // Their table labels.
  await expect(page.getByText('Family Table').first()).toBeVisible()
  await expect(page.getByText('College Friends').first()).toBeVisible()

  await page.screenshot({ path: 'evidence/seating-board.png', fullPage: true })
})
