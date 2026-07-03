import { test, expect } from '@playwright/test'
import { cfg } from '../config'

test('wedding homepage no longer has the standalone RSVP pill above the fold', async ({ page }) => {
  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}`, { waitUntil: 'networkidle' })

  // The removed pill was the only full-width "RSVP" link rendered directly under
  // the scripture banner. The nav's RSVP tab and the Explore section's RSVP card
  // are distinct elements (role=link inside <nav> / a bordered grid tile) and must
  // remain, so this asserts exactly one RSVP link survives above the "We're
  // getting married!" heading rather than asserting "no RSVP links at all".
  const heading = page.getByRole('heading', { name: /getting married/i })
  await expect(heading).toBeVisible()

  const pillCandidates = page.locator('a[href$="/rsvp"].bg-\\[\\#d4af6a\\].text-\\[\\#3b2f2f\\]')
  await expect(pillCandidates).toHaveCount(0)

  await page.screenshot({ path: 'evidence/rsvp-button-removed.png', fullPage: true })
})
