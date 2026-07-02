import { describe, it, expect, vi } from 'vitest'
import { runVenuePhotoUpload, type VenuePhotoUploadDeps } from './WebsiteSectionDrawer'
import { MAX_UPLOAD_BYTES } from '@/lib/upload'
import { isAllowedImageType } from '@/lib/normalizeImageFile'

// Issue #184: the page-builder "Event details" drawer uploaded a venue photo
// with no client-side type/size pre-check and no catch, so a rejected or failed
// upload was a silent no-op (the spinner reset and nothing else happened). The
// flow now validates and always resolves to either a photo URL or a specific
// error message. frontend-app's vitest runs in a node environment (no jsdom), so
// the behavioral contract is verified through the extracted pure function.

// Build a File without allocating real bytes for the over-limit case; the size
// is overridden directly (same trick logoUpload/photoBatchUpload tests use).
function fakeFile(name: string, size: number, type = 'image/jpeg'): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

// Simulate an Axios error: the parsed response body hangs on err.response.
function axiosError(status: number, data?: unknown): unknown {
  return { isAxiosError: true, response: { status, data } }
}

function problem(detail: string) {
  return { type: 'https://altarwed.com/problems/bad-request', title: 'Bad Request', status: 400, detail }
}

function deps(overrides: Partial<VenuePhotoUploadDeps> = {}): VenuePhotoUploadDeps {
  return {
    normalize: async f => f,
    isAllowedType: isAllowedImageType,
    upload: async () => 'https://cdn.altarwed.com/venue.jpg',
    ...overrides,
  }
}

describe('runVenuePhotoUpload', () => {
  it('uploads a valid file and returns the stored photo URL', async () => {
    const upload = vi.fn(async () => 'https://cdn.altarwed.com/venue.jpg')
    const result = await runVenuePhotoUpload(fakeFile('venue.jpg', 100), deps({ upload }))
    expect(upload).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ photoUrl: 'https://cdn.altarwed.com/venue.jpg' })
  })

  it('rejects an oversize file client-side before any network call', async () => {
    // The core bug: no client-side size pre-check. An over-cap file (common when
    // HEIC transcodes to JPEG) must be caught locally, never sent, with a
    // specific message instead of the pre-fix silent reset.
    const upload = vi.fn(async () => 'x')
    const result = await runVenuePhotoUpload(fakeFile('huge.jpg', MAX_UPLOAD_BYTES + 1), deps({ upload }))
    expect(upload).not.toHaveBeenCalled()
    expect(result).toEqual({ error: 'Image must be under 20 MB.' })
  })

  it('rejects a wrong-type file client-side before any network call', async () => {
    const upload = vi.fn(async () => 'x')
    const result = await runVenuePhotoUpload(fakeFile('doc.pdf', 100, 'application/pdf'), deps({ upload }))
    expect(upload).not.toHaveBeenCalled()
    expect(result).toEqual({ error: 'Only JPEG, PNG, or WebP images are supported.' })
  })

  it('size-checks the post-normalization file, not the picked file', async () => {
    // A small HEIC that balloons past the cap once converted to JPEG must be
    // rejected on its transcoded size (what we actually upload).
    const upload = vi.fn(async () => 'x')
    const normalize = async () => fakeFile('venue.jpg', MAX_UPLOAD_BYTES + 1)
    const result = await runVenuePhotoUpload(fakeFile('venue.heic', 100, 'image/heic'), deps({ upload, normalize }))
    expect(upload).not.toHaveBeenCalled()
    expect(result).toEqual({ error: 'Image must be under 20 MB.' })
  })

  it('surfaces the backend ProblemDetail detail on a 400 instead of failing silently', async () => {
    const detail = 'Image dimensions exceed the maximum of 40 megapixels.'
    const upload = vi.fn(async () => { throw axiosError(400, problem(detail)) })
    const result = await runVenuePhotoUpload(fakeFile('venue.jpg', 100), deps({ upload }))
    expect(result).toEqual({ error: detail })
  })

  it('shows the size-cap message on a 413 (payload too large)', async () => {
    const upload = vi.fn(async () => { throw axiosError(413) })
    const result = await runVenuePhotoUpload(fakeFile('venue.jpg', 100), deps({ upload }))
    expect('error' in result && result.error).toContain('20 MB')
  })

  it('surfaces a visible message on a network error / 5xx instead of a silent no-op', async () => {
    const upload = vi.fn(async () => { throw new Error('Network Error') })
    const result = await runVenuePhotoUpload(fakeFile('venue.jpg', 100), deps({ upload }))
    expect(result).toEqual({ error: 'Upload failed. Try again.' })
  })

  it('never throws when normalize rejects; returns an actionable message', async () => {
    const upload = vi.fn(async () => 'x')
    const normalize = async () => { throw new Error('cannot decode') }
    const result = await runVenuePhotoUpload(fakeFile('venue.heic', 100), deps({ upload, normalize }))
    expect(upload).not.toHaveBeenCalled()
    expect(result).toEqual({ error: 'Upload failed. Try again.' })
  })
})
