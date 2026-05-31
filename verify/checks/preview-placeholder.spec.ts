import { test, expect } from '@playwright/test'
import { cfg } from '../helpers/login'

// Verifies the BlockRenderer change: an empty data-driven card (here the empty
// registry) shows a "fill this in" placeholder in the EDITOR PREVIEW, but guests
// on the live public page never see that scaffold.
//
// Requires the public site (frontend-public) running on cfg.publicUrl. No login,
// the preview slug is the unguessable secret, same as theknot/zola.
test('empty registry card shows a placeholder only in the editor preview', async ({ page }) => {
  // preview=true -> placeholder visible
  await page.goto(`${cfg.publicUrl}/preview/${cfg.slug}/registry`)
  await expect(page.getByText(/Add a registry link/i)).toBeVisible()
  await page.screenshot({ path: 'evidence/preview-registry-placeholder.png', fullPage: true })

  // Live public home (preview=false) -> guests never see the scaffold copy
  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}`)
  await expect(page.getByText(/Add a registry link/i)).toHaveCount(0)
})
