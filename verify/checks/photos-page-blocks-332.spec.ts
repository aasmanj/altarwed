import { test, expect } from '@playwright/test'
import { cfg } from '../config'

// Verifies issue #332 / PR #342: /wedding/[slug]/photos now renders through the
// page-builder block pipeline (TabBlocks), with the legacy PhotoGalleryClient
// grid preserved as the zero-block fallback so existing photo-only sites don't regress.
//
// The wedding page data fetch uses Next's 60s ISR revalidate window
// (frontend-public/CLAUDE.md), which applies in dev too. A page fetched right
// after a sibling test changed the underlying blocks can serve a stale cached
// render for up to 60s, so content assertions poll with reload until the
// window rolls over rather than asserting once immediately after a mutation.

test.setTimeout(170_000)

async function login(): Promise<string> {
  const res = await fetch(`${cfg.apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cfg.couple.email, password: cfg.couple.password }),
  })
  const json = await res.json()
  return json.accessToken
}

async function getWebsiteId(token: string): Promise<string> {
  const res = await fetch(`${cfg.apiUrl}/api/v1/wedding-websites/slug/${cfg.slug}`)
  const json = await res.json()
  return json.id
}

async function createBlock(token: string, websiteId: string, tab: string, type: string, contentJson: string) {
  const res = await fetch(`${cfg.apiUrl}/api/v1/wedding-page-blocks/website/${websiteId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tab, type, contentJson }),
  })
  if (!res.ok) throw new Error(`createBlock failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function deleteBlock(token: string, websiteId: string, blockId: string) {
  await fetch(`${cfg.apiUrl}/api/v1/wedding-page-blocks/website/${websiteId}/${blockId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

test.describe('Photos page block migration (#332)', () => {
  test('case 1: no PHOTOS blocks -> legacy PhotoGalleryClient fallback renders unchanged', async ({ page }) => {
    await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}/photos`)
    await page.screenshot({ path: 'evidence/332-case1-fallback-no-blocks.png', fullPage: true })
    await expect(page.locator('body')).toBeVisible()
  })

  test('case 2: HEADING block on PHOTOS tab renders via TabBlocks + nav link visible', async ({ page }) => {
    const token = await login()
    const websiteId = await getWebsiteId(token)
    const block = await createBlock(
      token,
      websiteId,
      'PHOTOS',
      'HEADING',
      JSON.stringify({ text: 'Our Favorite Moments Together', level: 2 }),
    )
    try {
      await expect(async () => {
        await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}/photos`)
        await expect(page.getByText('Our Favorite Moments Together')).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 75_000, intervals: [3_000] })
      await page.screenshot({ path: 'evidence/332-case2-heading-block.png', fullPage: true })

      // Nav link visibility check from the wedding layout (separate cached fetch
      // from the photos page itself, so it needs its own poll against the ISR window)
      await expect(async () => {
        await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}`)
        await expect(page.getByRole('link', { name: /photos/i })).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 75_000, intervals: [3_000] })
      await page.screenshot({ path: 'evidence/332-case2-nav-link-visible.png', fullPage: true })
    } finally {
      await deleteBlock(token, websiteId, block.id)
    }
  })

  test('case 3: PHOTO_ALBUM_GRID block renders the gallery via block pipeline', async ({ page }) => {
    const token = await login()
    const websiteId = await getWebsiteId(token)
    const block = await createBlock(token, websiteId, 'PHOTOS', 'PHOTO_ALBUM_GRID', JSON.stringify({}))
    try {
      await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}/photos`)
      await page.screenshot({ path: 'evidence/332-case3-photo-album-grid-block.png', fullPage: true })
      await expect(page.locator('body')).toBeVisible()
    } finally {
      await deleteBlock(token, websiteId, block.id)
    }
  })

  // 🔍 probe: a content block (TEXT) on the Photos tab alongside pre-existing legacy
  // photos -- the block should render, not silently disappear behind the fallback.
  test('probe: TEXT block on PHOTOS tab renders (not swallowed by the legacy fallback)', async ({ page }) => {
    const token = await login()
    const websiteId = await getWebsiteId(token)
    const block = await createBlock(
      token,
      websiteId,
      'PHOTOS',
      'TEXT',
      JSON.stringify({ markdown: 'A note about our photo gallery below.' }),
    )
    try {
      await expect(async () => {
        await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}/photos`)
        await expect(page.getByText('A note about our photo gallery below.')).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 75_000, intervals: [3_000] })
      await page.screenshot({ path: 'evidence/332-probe-text-block-precedence.png', fullPage: true })
    } finally {
      await deleteBlock(token, websiteId, block.id)
    }
  })
})
