import { test, expect } from '@playwright/test'
import { cfg } from '../config'

// Proves each selectable hero font actually LOADS and renders as its own face (rather than
// silently falling back to serif and looking identical). Pure frontend: the homepage pulls in
// the root layout, which declares every next/font @font-face and --font-* variable, so this
// needs NO backend. Mirrors the keys/stacks/weights in frontend-public/src/lib/safeFont.ts.
const FONTS = [
  { key: 'playfair',      stack: 'var(--font-playfair), Georgia, serif',        weight: '700' },
  { key: 'cinzel',        stack: 'var(--font-cinzel), Georgia, serif',          weight: '700' },
  { key: 'greatvibes',    stack: 'var(--font-great-vibes), cursive',            weight: '400' },
  { key: 'dancingscript', stack: 'var(--font-dancing-script), cursive',         weight: '700' },
  { key: 'montserrat',    stack: 'var(--font-montserrat), system-ui, sans-serif', weight: '700' },
]

test('all five name fonts load and render as distinct faces', async ({ page }) => {
  await page.goto(`${cfg.publicUrl}/`, { waitUntil: 'domcontentloaded' })

  await page.evaluate((fonts) => {
    const panel = document.createElement('div')
    panel.id = 'font-showcase'
    panel.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#2b2320;color:#fff;padding:44px;overflow:auto;'
    panel.innerHTML = fonts.map(f =>
      `<div style="margin-bottom:30px">
         <div style="font:600 12px system-ui;letter-spacing:2px;text-transform:uppercase;color:#d4af6a;margin-bottom:6px">${f.key}</div>
         <div class="sample" style="font-family:${f.stack};font-weight:${f.weight};font-size:56px;line-height:1.15">Verify Bride &amp; Verify Groom</div>
       </div>`
    ).join('')
    document.body.appendChild(panel)
  }, FONTS)

  // Wait for the font files to actually load before measuring / screenshotting.
  await page.evaluate(async () => { await (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready })
  await page.waitForTimeout(600)

  // Each sample must resolve to a DIFFERENT primary font family. next/font hashes each family
  // (e.g. "__Cinzel_abc"), so 5 loaded fonts -> 5 distinct first-tokens. If any silently fell
  // back to serif, two would collapse to "georgia"/"cursive" and this Set shrinks below 5.
  const primary = await page.$$eval('#font-showcase .sample',
    els => els.map(e => getComputedStyle(e).fontFamily.split(',')[0].trim().toLowerCase()))
  expect(new Set(primary).size, `resolved families: ${JSON.stringify(primary)}`).toBe(FONTS.length)

  await page.screenshot({ path: 'evidence/name-fonts-showcase.png', fullPage: true })
})
