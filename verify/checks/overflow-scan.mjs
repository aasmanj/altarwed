// Mobile-portrait horizontal-overflow scanner. For each page, loads it at a
// phone viewport and reports (a) whether the document scrolls horizontally and
// (b) which elements extend past the right edge of the viewport.
// Usage: node verify/checks/overflow-scan.mjs [baseUrl]
// Fixtures: the wedding routes assume the seeded verify couple (SLUG below) and
// the vendor route assumes the seeded vendor id, i.e. a run-altarwed environment
// (or the mock API). A page answering >=400 FAILS the scan rather than passing
// vacuously (an error page has no overflow, which is not the same as healthy).
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const SLUG = 'the-verify-wedding'

const PAGES = [
  '/',
  '/for-vendors',
  '/vendors',
  `/vendors/ba8eb512-086d-43bc-ac2d-f15e0e8a492e`,
  '/blog',
  '/blog/christian-wedding-planning-guide-1',
  '/resources',
  '/find-wedding',
  '/help',
  '/privacy',
  '/terms',
  `/wedding/${SLUG}`,
  `/wedding/${SLUG}/story`,
  `/wedding/${SLUG}/details`,
  `/wedding/${SLUG}/wedding-party`,
  `/wedding/${SLUG}/registry`,
  `/wedding/${SLUG}/travel`,
  `/wedding/${SLUG}/photos`,
  `/wedding/${SLUG}/rsvp`,
]

// iPhone 12/13/14 portrait and a narrower older-Android portrait.
const VIEWPORTS = [
  { name: 'iphone-390', width: 390, height: 844 },
  { name: 'android-360', width: 360, height: 800 },
  { name: 'se-320', width: 320, height: 568 },
]

const scan = () => {
  const vw = document.documentElement.clientWidth
  const docOverflow = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0,
  ) - vw
  const offenders = []
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    // Elements inside an overflow-x:auto/hidden ancestor are clipped/scrollable
    // by design (e.g. the tab nav); skip them.
    let clipped = false
    for (let a = el.parentElement; a; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') { clipped = true; break }
    }
    if (clipped) continue
    const over = Math.round(Math.max(r.right - vw, -r.left))
    if (over > 1) {
      offenders.push({
        over,
        w: Math.round(r.width),
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute('class') || '').slice(0, 140),
        text: (el.textContent || '').trim().slice(0, 60),
      })
    }
  }
  offenders.sort((a, b) => b.over - a.over)
  return { vw, docOverflow, offenders: offenders.slice(0, 8) }
}

const browser = await chromium.launch()
let anyBad = false
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()
  for (const path of PAGES) {
    try {
      const resp = await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 })
      await page.waitForTimeout(400)
      const r = await page.evaluate(scan)
      const badStatus = !resp || resp.status() >= 400
      const bad = badStatus || r.docOverflow > 1
      if (bad) anyBad = true
      const flag = badStatus ? 'HTTP-ERR' : bad ? 'OVERFLOW' : 'ok'
      console.log(`[${vp.name}] ${flag.padEnd(8)} ${String(resp?.status()).padEnd(4)} doc+${r.docOverflow}px  ${path}`)
      if (bad) for (const o of r.offenders) {
        console.log(`    +${o.over}px w=${o.w} <${o.tag}> class="${o.cls}" text="${o.text}"`)
      }
    } catch (e) {
      anyBad = true
      console.log(`[${vp.name}] ERROR    ${path}: ${String(e).split('\n')[0]}`)
    }
  }
  await ctx.close()
}
await browser.close()
process.exit(anyBad ? 1 : 0)
