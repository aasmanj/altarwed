import { test, expect } from '@playwright/test'
import { login, cfg } from '../helpers/login'

// Pre-merge verification for the 2026-07-02 overnight UX/reliability batch
// (issues #182-190, PRs #191-199, all merged into a disposable local
// integration-verify branch). Each test targets one specific fix.

async function loginVendor(page: import('@playwright/test').Page) {
  await page.goto(`${cfg.appUrl}/login`)
  await page.locator('input[type="email"]').fill('vendor@verify.test')
  await page.locator('input[type="password"]').fill('VerifyPass123!')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/vendor/, { timeout: 15_000 })
}

// #183 / PR #191 -- vendor portfolio photo delete must confirm before deleting.
// The delete button is only visible on hover (group-hover), so hover the photo
// tile before interacting with it -- that's the real UX, not a test workaround.
test('vendor portfolio delete shows a confirm dialog, cancel keeps the photo, confirm removes it', async ({ page }) => {
  await loginVendor(page)
  await page.goto(`${cfg.appUrl}/vendor/listing`)

  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  // Count by the delete buttons themselves (one per real photo entity), not a
  // generic class selector -- precise and independent of hover-visibility CSS.
  const deleteButtons = page.getByLabel('Delete photo')
  await page.waitForLoadState('networkidle')
  if ((await deleteButtons.count()) === 0) {
    const fileInput = page.getByLabel('Upload portfolio photo')
    await fileInput.setInputFiles({ name: 'portfolio.png', mimeType: 'image/png', buffer: tinyPng })
    await expect(deleteButtons).toHaveCount(1, { timeout: 15_000 })
  }

  const countBefore = await deleteButtons.count()

  let nativeDialog = false
  page.on('dialog', async d => { nativeDialog = true; await d.dismiss() })

  const firstTile = page.locator('.group.relative', { has: deleteButtons.first() })
  await firstTile.hover()
  await deleteButtons.first().click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await page.screenshot({ path: 'evidence/vendor-portfolio-delete-confirm.png', fullPage: true })

  // Cancel: photo must remain.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(deleteButtons).toHaveCount(countBefore)

  // Confirm: photo must actually be removed.
  await firstTile.hover()
  await deleteButtons.first().click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /remove/i }).click()
  await expect(deleteButtons).toHaveCount(countBefore - 1, { timeout: 10_000 })

  expect(nativeDialog, 'a native browser confirm() fired instead of the custom dialog').toBe(false)
  await page.screenshot({ path: 'evidence/vendor-portfolio-delete-after.png', fullPage: true })
})

// #184 / PR #192 -- venue photo upload must surface an error, not fail silently.
test('venue photo upload rejects a non-image file with a visible error', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/website/editor`)
  await page.waitForLoadState('networkidle')

  // Switch to the DETAILS tab, click the seeded VENUE_CARD block to open its
  // inline form, then its "Edit venue details" button opens the drawer.
  await page.getByRole('button', { name: /^details$/i }).click()
  await page.getByText(/venue/i).first().click()
  const editVenueBtn = page.getByRole('button', { name: /edit venue details/i })
  await expect(editVenueBtn).toBeVisible({ timeout: 10_000 })
  await editVenueBtn.click()

  const drawer = page.locator('[aria-label="Event details"]')
  await expect(drawer).toBeVisible({ timeout: 5_000 })

  const venueFileInput = drawer.locator('input[type="file"]').first()
  await venueFileInput.setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('this is not an image'),
  })

  await expect(drawer.getByText(/only jpeg|only jpg|supported|image/i)).toBeVisible({ timeout: 5_000 })
  await page.screenshot({ path: 'evidence/venue-photo-upload-error.png', fullPage: true })
})

// #182 / PR #193 -- hero focal point crop must update the live preview without refresh.
// Requires a heroPhotoUrl set (the crop control only renders when one exists);
// verify/seed.mjs doesn't set one, so this run sets it via the API first.
test('hero focal point reposition updates the preview iframe', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/website/editor`)
  await page.waitForLoadState('networkidle')

  const heroToggle = page.getByRole('button', { name: /hero/i }).first()
  await heroToggle.click()

  const cropControl = page.getByLabel(/focal point picker/i)
  await expect(cropControl).toBeVisible({ timeout: 10_000 })

  const iframe = page.frameLocator('iframe').first()
  const heroImgBefore = await iframe.locator('img').first().getAttribute('style').catch(() => null)

  const box = await cropControl.boundingBox()
  if (!box) throw new Error('focal point picker has no bounding box')
  await page.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.15)
  await page.waitForTimeout(1500)

  const heroImgAfter = await iframe.locator('img').first().getAttribute('style').catch(() => null)
  await page.screenshot({ path: 'evidence/hero-focal-point-preview.png', fullPage: true })

  expect(heroImgAfter, 'hero image object-position in the preview iframe did not change after repositioning the crop').not.toBe(heroImgBefore)
})

// #187 / PR #196 -- Travel tab must not show "No hotels added yet" when hotels already exist.
// /dashboard/website now redirects into the page builder (issue #181); ?tab= is preserved.
test('travel tab does not show the empty state for a couple with a seeded hotel', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/website?tab=travel`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/no hotels added yet/i)).toHaveCount(0)
  await page.screenshot({ path: 'evidence/travel-tab-no-flash.png', fullPage: true })
})

// #185 / PR #194 -- dashboard form inputs must have real accessible names.
// getByLabel only resolves when the <label> is programmatically associated
// (nested or htmlFor/id), so this directly proves the fix rather than being a
// tautological check on visible text. Rewritten for issue #181: the classic
// editor is retired, so these fields are now reached through the page builder
// (Bride/Groom name in the Hero panel; Wedding date/Venue name in the Details
// drawer, opened via the seeded Venue card block), not a fixed tab layout.
test('page builder name/date/venue inputs are reachable by their accessible label', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/website/editor`)
  await page.waitForLoadState('networkidle')

  const heroToggle = page.getByRole('button', { name: /hero/i }).first()
  await heroToggle.click()
  await expect(page.getByLabel('Bride')).toBeVisible()
  await expect(page.getByLabel('Groom')).toBeVisible()
  await expect(page.getByLabel('Bride')).toHaveValue(/./)

  // Wedding date + Venue name live in the Details drawer, opened from the
  // seeded Venue card block on the Details tab.
  await page.getByRole('button', { name: 'Details' }).click()
  await page.getByRole('button', { name: 'Venue card' }).click()
  await page.getByRole('button', { name: 'Edit venue details' }).click()
  await expect(page.getByLabel('Venue name')).toBeVisible()
  await expect(page.getByLabel('Wedding date')).toBeVisible()
})

// #186 / PR #195 -- wedding-party avatar hover-upload must reject a bad file with a message.
// Requires an existing member (seeded via the API for this run rather than
// driving the fragile add-member form, which isn't the thing under test here).
test('wedding party avatar hover-upload rejects a non-image file with a message', async ({ page }) => {
  await login(page)
  await page.goto(`${cfg.appUrl}/dashboard/wedding-party`)
  await page.waitForLoadState('networkidle')

  // The aria-label lives on the visible trigger <button> (which calls
  // fileInputRef.current.click()); the actual <input type="file"> is a
  // separate, hidden sibling with no label of its own. setInputFiles works
  // on it directly without needing to click the button first.
  await expect(page.getByLabel(/^Upload photo for/).first()).toBeAttached({ timeout: 10_000 })
  const avatarUpload = page.locator('input[type="file"]').first()
  await expect(avatarUpload).toBeAttached({ timeout: 10_000 })
  await avatarUpload.setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('this is not an image'),
  })
  await expect(page.getByText(/only jpeg|only jpg|supported|image/i)).toBeVisible({ timeout: 5_000 })
  await page.screenshot({ path: 'evidence/wedding-party-avatar-upload-error.png', fullPage: true })
})
