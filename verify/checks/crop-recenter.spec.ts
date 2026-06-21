import { test, expect, type APIRequestContext } from '@playwright/test'
import zlib from 'node:zlib'
import { login, cfg } from '../helpers/login'

// ── Test image: a 240x160 PNG split into 4 colored quadrants, so a reposition
// (object-position) or zoom (scale) visibly changes which quadrant fills the frame.
// Hand-rolled encoder so we need no image dependency.
function crc32(buf: Buffer): number {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}
function makeQuadrantPng(w = 240, h = 160): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3))
  let p = 0
  for (let y = 0; y < h; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      const left = x < w / 2, top = y < h / 2
      const [r, g, b] = top ? (left ? [220, 40, 40] : [40, 160, 40])
                            : (left ? [40, 80, 200] : [230, 200, 40])
      raw[p++] = r; raw[p++] = g; raw[p++] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit, color type 2 (RGB)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))])
}
const PNG = makeQuadrantPng()

// Set a React-controlled range input reliably (native setter so React's value
// tracker registers the change, then fire input which maps to React onChange).
async function setRange(page: import('@playwright/test').Page, selector: string, value: string) {
  await page.locator(selector).evaluate((el, v) => {
    const proto = window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
    setter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

// Drag inside the reposition frame to move the focal point. The preview <img> is
// pointer-events-none so the coords land on the frame div, which handles the drag.
async function dragFrame(page: import('@playwright/test').Page, dx: number, dy: number) {
  const img = page.locator('[role="dialog"] img[alt="Reposition preview"]')
  const box = (await img.boundingBox())!
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 })
  await page.mouse.up()
}

async function apiSetup(request: APIRequestContext) {
  const loginRes = await request.post(`${cfg.apiUrl}/api/v1/auth/login`, {
    data: { email: cfg.couple.email, password: cfg.couple.password },
  })
  expect(loginRes.ok(), `login ${loginRes.status()}`).toBeTruthy()
  const token = (await loginRes.json()).accessToken as string
  const auth = { Authorization: `Bearer ${token}` }

  const siteRes = await request.get(`${cfg.apiUrl}/api/v1/wedding-websites/slug/${cfg.slug}`)
  expect(siteRes.ok(), `get website ${siteRes.status()}`).toBeTruthy()
  const websiteId = (await siteRes.json()).id as string

  // The verify DB persists across runs in one backend session, so clear any
  // members/photos left by a prior run to keep selectors unambiguous (exactly one
  // member, one album photo after setup).
  for (const m of await (await request.get(`${cfg.apiUrl}/api/v1/wedding-party/website/${websiteId}`, { headers: auth })).json())
    await request.delete(`${cfg.apiUrl}/api/v1/wedding-party/website/${websiteId}/${m.id}`, { headers: auth })
  for (const ph of await (await request.get(`${cfg.apiUrl}/api/v1/wedding-photos/website/${websiteId}`, { headers: auth })).json())
    await request.delete(`${cfg.apiUrl}/api/v1/wedding-photos/website/${websiteId}/${ph.id}`, { headers: auth })

  // Wedding-party member with a photo.
  const memberRes = await request.post(`${cfg.apiUrl}/api/v1/wedding-party/website/${websiteId}`, {
    headers: auth,
    data: { name: 'Crop Tester', role: 'Best Man', side: 'GROOM', sortOrder: 0 },
  })
  expect(memberRes.ok(), `add member ${memberRes.status()}`).toBeTruthy()
  const memberId = (await memberRes.json()).id as string
  const mPhoto = await request.post(`${cfg.apiUrl}/api/v1/uploads/wedding-party/${websiteId}/${memberId}/photo`, {
    headers: auth,
    multipart: { file: { name: 'q.png', mimeType: 'image/png', buffer: PNG } },
  })
  expect(mPhoto.ok(), `member photo ${mPhoto.status()}`).toBeTruthy()

  // Album photo.
  const aPhoto = await request.post(`${cfg.apiUrl}/api/v1/uploads/wedding-websites/${websiteId}/photos`, {
    headers: auth,
    multipart: { file: { name: 'q.png', mimeType: 'image/png', buffer: PNG } },
  })
  expect(aPhoto.ok(), `album photo ${aPhoto.status()}`).toBeTruthy()

  return { websiteId, memberId, token }
}

test('crop/recenter: reposition persists and renders in dashboard + public', async ({ page, request }) => {
  test.setTimeout(120_000)
  await apiSetup(request)
  await login(page)

  // ── 1. Wedding party: reposition the member avatar ─────────────────────────
  await page.goto(`${cfg.appUrl}/dashboard/wedding-party`)
  await expect(page.getByText('Crop Tester')).toBeVisible()
  await page.getByRole('button', { name: 'Reposition' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await dragFrame(page, 55, -35)
  await setRange(page, '#reposition-zoom', '2.4')
  await page.screenshot({ path: 'evidence/crop-party-modal.png' })
  await page.getByRole('button', { name: 'Save position' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // Reload to prove persistence (re-fetch from the API), then read the rendered style.
  await page.reload()
  const partyImg = page.locator('img[alt="Crop Tester"]').first()
  await expect(partyImg).toBeVisible()
  const partyStyle = await partyImg.evaluate(el => ({
    transform: (el as HTMLElement).style.transform,
    objectPosition: (el as HTMLElement).style.objectPosition,
  }))
  expect(partyStyle.transform).toContain('scale(2.4)')
  expect(partyStyle.objectPosition).not.toBe('50% 50%')
  await page.screenshot({ path: 'evidence/crop-party-dashboard.png', fullPage: true })

  // ── 2. Photo album: reposition a photo ─────────────────────────────────────
  await page.goto(`${cfg.appUrl}/dashboard/photos`)
  // The crop button lives in a hover overlay (pointer-events-none until group-hover).
  // Raw mouse-move over the card triggers :hover with no interception check, then click.
  const albumCard = page.locator('.grid > div').first()
  const cardBox = (await albumCard.boundingBox())!
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await page.locator('[title="Reposition photo"]').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await dragFrame(page, -50, 40)
  await setRange(page, '#reposition-zoom', '1.8')
  await page.screenshot({ path: 'evidence/crop-photos-modal.png' })
  await page.getByRole('button', { name: 'Save position' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.reload()
  const albumImg = page.locator('.grid img').first()
  await expect(albumImg).toBeVisible()
  const albumTransform = await albumImg.evaluate(el => (el as HTMLElement).style.transform)
  expect(albumTransform).toContain('scale(1.8)')
  await page.screenshot({ path: 'evidence/crop-photos-dashboard.png', fullPage: true })

  // ── 3. Public site renders the same framing ────────────────────────────────
  // First goto compiles the route in Next dev (slow, can stream just the layout);
  // reload once it is compiled so the full server render is present, then assert.
  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}/wedding-party`)
  await page.reload({ waitUntil: 'networkidle' })
  const pubPartyImg = page.locator('img[alt="Crop Tester"]').first()
  await expect(pubPartyImg).toBeVisible({ timeout: 20_000 })
  expect(await pubPartyImg.evaluate(el => (el as HTMLElement).style.transform)).toContain('scale(2.4)')
  await page.screenshot({ path: 'evidence/crop-public-party.png', fullPage: true })

  await page.goto(`${cfg.publicUrl}/wedding/${cfg.slug}/photos`)
  await page.reload({ waitUntil: 'networkidle' })
  const pubAlbumImg = page.locator('.grid img').first()
  await expect(pubAlbumImg).toBeVisible({ timeout: 20_000 })
  expect(await pubAlbumImg.evaluate(el => (el as HTMLElement).style.transform)).toContain('scale(1.8)')
  await page.screenshot({ path: 'evidence/crop-public-photos.png', fullPage: true })

  // ── 4. Probe: re-uploading a member photo resets framing to centered ───────
  await page.goto(`${cfg.appUrl}/dashboard/wedding-party`)
  // setInputFiles works on the hidden avatar file input directly, no hover needed.
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'q2.png', mimeType: 'image/png', buffer: PNG })
  await expect.poll(async () =>
    page.locator('img[alt="Crop Tester"]').first().evaluate(el => (el as HTMLElement).style.transform),
    { timeout: 10_000 },
  ).not.toContain('scale')
  await page.screenshot({ path: 'evidence/crop-probe-reset.png' })
})
