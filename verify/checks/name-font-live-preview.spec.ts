import { test, expect } from '@playwright/test'
import { login, cfg } from '../helpers/login'

// Reproduces + verifies the couple's report: changing the Names font in the editor should show
// in the SIDE-BY-SIDE preview iframe immediately, without clicking "View live". Drives the real
// dashboard picker and reads the computed font of the preview iframe's hero name.

test('picking a font updates the preview hero live (no reload, no View live)', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/website/editor`)

  // The preview iframe (points at frontend-public /preview/[slug]/home).
  const heroName = page.frameLocator('iframe').getByRole('heading', { name: cfg.couple.partnerTwoName })
  await expect(heroName).toBeVisible({ timeout: 20_000 })
  // Let the iframe hydrate so HeroLive's postMessage listener is attached before we drive the
  // picker (a couple changing the font in the first instant would otherwise miss the live push,
  // though the save still persists it for the next render).
  await page.waitForTimeout(1200)
  const fontOf = () => heroName.evaluate(el => getComputedStyle(el).fontFamily.toLowerCase())

  await page.getByRole('button', { name: /Hero photo/i }).click()
  const picker = page.locator('#hero-name-font')

  // Drive a live transition between two selections. The iframe is NOT reloaded (the font save
  // dropped bumpPreview), so any change we see came purely from the live postMessage. Prove
  // BOTH directions so a stale starting value can't produce a false pass.
  await picker.selectOption('playfair')
  await expect(async () => expect(await fontOf()).not.toMatch(/great.?vibes/)).toPass({ timeout: 8_000 })

  await picker.selectOption('greatvibes')
  await expect(async () => expect(await fontOf()).toMatch(/great.?vibes/)).toPass({ timeout: 8_000 })

  await page.screenshot({ path: 'evidence/name-font-live-preview.png', fullPage: true })
})
