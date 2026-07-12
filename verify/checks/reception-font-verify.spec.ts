import { test, expect, request as pwRequest } from '@playwright/test'
import { login, cfg } from '../helpers/login'

// Verifies the two new couple-website features end to end against the running stack:
//   1. Couple-name font picker (nameFont) -> hero names render in the chosen font.
//   2. Reception venue + titles -> a second, labeled venue card on the public details page.
// Data is set through the REAL authenticated API (proves backend persistence of the new
// columns), then the PUBLIC site is screenshotted (proves the render). The default couple
// (coupleB, untouched) is the control: default serif names, no reception card.

const coupleId = 'ef05afd0-f368-4687-a278-fff7bbad23bc' // seeded verify couple (couple@verify.test)

async function coupleToken(): Promise<string> {
  const ctx = await pwRequest.newContext({ baseURL: cfg.apiUrl })
  const res = await ctx.post('/api/v1/auth/login', {
    data: { email: cfg.couple.email, password: cfg.couple.password },
  })
  expect(res.ok(), `login failed: ${res.status()}`).toBeTruthy()
  const body = await res.json()
  const token = body.accessToken ?? body.token
  expect(token, 'no access token in login response').toBeTruthy()
  await ctx.dispose()
  return token
}

test('sets ceremony + reception venue and a script name font via the API', async () => {
  const token = await coupleToken()
  const ctx = await pwRequest.newContext({
    baseURL: cfg.apiUrl,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  const res = await ctx.patch(`/api/v1/wedding-websites/couple/${coupleId}`, {
    data: {
      // ceremony venue (so the ceremony card renders alongside the reception one)
      venueName: 'Grace Community Church',
      venueAddress: '100 Chapel Way',
      venueCity: 'Austin',
      venueState: 'TX',
      ceremonyTime: '3:00 PM',
      ceremonyVenueTitle: 'Ceremony',
      // reception venue: a genuinely different address + its own label
      receptionVenueName: 'The Grand Hall',
      receptionVenueAddress: '500 River Road',
      receptionVenueCity: 'Round Rock',
      receptionVenueState: 'TX',
      receptionTime: '6:00 PM',
      receptionVenueTitle: 'Reception',
      // greatvibes is a visually unmistakable script face -> obvious the font changed
      nameFont: 'greatvibes',
    },
  })
  expect(res.ok(), `PATCH failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  const saved = await res.json()
  // Round-trip: the new columns persisted and come back on the owner response.
  expect(saved.nameFont).toBe('greatvibes')
  expect(saved.receptionVenueName).toBe('The Grand Hall')
  expect(saved.receptionVenueTitle).toBe('Reception')
  await ctx.dispose()
})

test('public hero renders the couple names in the chosen script font', async ({ page }) => {
  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}`, { waitUntil: 'networkidle' })
  const brideHeading = page.getByRole('heading', { name: cfg.couple.partnerTwoName })
  await expect(brideHeading).toBeVisible()
  // The hero name font-family must resolve to the Great Vibes variable, not the serif default.
  const fontFamily = await brideHeading.evaluate(el => getComputedStyle(el).fontFamily)
  // next/font hashes the family name (e.g. "__Great_Vibes_a1b2c3"), so match loosely.
  expect(fontFamily.toLowerCase()).toMatch(/great.?vibes/)
  await page.screenshot({ path: 'evidence/hero-name-font.png', fullPage: false })
})

test('public details page shows two labeled venue cards (ceremony + reception)', async ({ page }) => {
  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}/details`, { waitUntil: 'networkidle' })
  // .first(): the venue names also appear in the page's JSON-LD / OG metadata, so several
  // text nodes match; the visible card body is the first.
  await expect(page.getByText('Grace Community Church').first()).toBeVisible()
  await expect(page.getByText('The Grand Hall').first()).toBeVisible()
  // Both venues render distinct addresses (proves it's two locations, not one duplicated).
  await expect(page.getByText(/100 Chapel Way/).first()).toBeVisible()
  await expect(page.getByText(/500 River Road/).first()).toBeVisible()
  // Both couple-set card labels render.
  await expect(page.getByText('Reception', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: 'evidence/two-venue-cards.png', fullPage: true })
})

test('editor exposes the Names font picker in the hero panel', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/website/editor`)
  // Expand the hero panel, then the font <select> must be present and operable.
  const heroToggle = page.getByRole('button', { name: /Hero photo/i })
  await heroToggle.click()
  const fontSelect = page.locator('#hero-name-font')
  await expect(fontSelect).toBeVisible()
  await expect(fontSelect.locator('option')).toContainText(['Playfair (classic serif, default)'])
  await page.screenshot({ path: 'evidence/editor-font-picker.png', fullPage: false })
})
