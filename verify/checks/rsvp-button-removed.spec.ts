import { test, expect } from '@playwright/test'
import { cfg } from '../config'

test('wedding homepage no longer has the standalone RSVP pill above the fold', async ({ page }) => {
  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'evidence/rsvp-button-removed.png', fullPage: true })
})
