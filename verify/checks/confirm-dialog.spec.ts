import { test, expect } from '@playwright/test'
import { login, cfg } from '../helpers/login'

// Verifies the PR's headline change: destructive actions use the custom
// accessible ConfirmDialog (role="alertdialog"), not the browser-native
// window.confirm(). A native dialog would be caught by the listener below and
// fail the test.
test('guest remove uses the custom ConfirmDialog, not native confirm()', async ({ page }) => {
  let nativeDialog = false
  page.on('dialog', async d => { nativeDialog = true; await d.dismiss() })

  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/guests`)

  await page.getByRole('button', { name: 'Remove' }).first().click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(/Remove .+\?/)
  await page.screenshot({ path: 'evidence/confirm-dialog.png' })

  // Escape must cancel (accessibility requirement) and no native dialog ever fired.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(nativeDialog, 'a native browser confirm() dialog appeared').toBe(false)
})
