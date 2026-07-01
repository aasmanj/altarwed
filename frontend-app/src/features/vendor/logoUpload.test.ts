import { describe, it, expect, vi } from 'vitest'
import { runLogoUpload, type LogoUploadDeps } from './logoUpload'
import { MAX_UPLOAD_BYTES } from '@/lib/upload'

// Build a File without allocating real bytes for the over-limit case; the size
// is overridden directly (same trick photoBatchUpload.test uses).
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

function deps(overrides: Partial<LogoUploadDeps> = {}): LogoUploadDeps {
  return {
    normalize: async f => f,
    upload: async () => undefined,
    ...overrides,
  }
}

describe('runLogoUpload', () => {
  it('uploads a valid file and reports success (null error)', async () => {
    const upload = vi.fn(async () => undefined)
    const result = await runLogoUpload(fakeFile('logo.jpg', 100), deps({ upload }))
    expect(upload).toHaveBeenCalledTimes(1)
    expect(result).toBeNull()
  })

  it('rejects an oversize file client-side before any network call (#145)', async () => {
    // The core bug: no client-side size pre-check. An over-cap file (common when
    // HEIC transcodes to JPEG) must be caught locally, never sent.
    const upload = vi.fn(async () => undefined)
    const result = await runLogoUpload(fakeFile('huge.jpg', MAX_UPLOAD_BYTES + 1), deps({ upload }))
    expect(upload).not.toHaveBeenCalled()
    expect(result).toBe('Logo must be under 20 MB.')
  })

  it('size-checks the post-normalization file, not the picked file', async () => {
    // A small HEIC that balloons past the cap once converted to JPEG must be
    // rejected on its transcoded size (what we actually upload), not its original.
    const upload = vi.fn(async () => undefined)
    const normalize = async () => fakeFile('logo.jpg', MAX_UPLOAD_BYTES + 1)
    const result = await runLogoUpload(fakeFile('logo.heic', 100, 'image/heic'), deps({ upload, normalize }))
    expect(upload).not.toHaveBeenCalled()
    expect(result).toBe('Logo must be under 20 MB.')
  })

  it('surfaces the backend ProblemDetail detail on a 400 (the swallowed-error bug)', async () => {
    // Before the fix this became the fixed "Logo upload failed" string; the
    // vendor must instead see the real reason (here, the dimension cap).
    const detail = 'Image dimensions exceed the maximum of 40 megapixels.'
    const upload = vi.fn(async () => { throw axiosError(400, problem(detail)) })
    const result = await runLogoUpload(fakeFile('logo.jpg', 100), deps({ upload }))
    expect(result).toBe(detail)
  })

  it('shows the size-cap message on a 413 (payload too large)', async () => {
    const upload = vi.fn(async () => { throw axiosError(413) })
    const result = await runLogoUpload(fakeFile('logo.jpg', 100), deps({ upload }))
    expect(result).toContain('20 MB')
  })

  it('falls back to the logo-specific message on a network error / 5xx', async () => {
    const upload = vi.fn(async () => { throw new Error('Network Error') })
    const result = await runLogoUpload(fakeFile('logo.jpg', 100), deps({ upload }))
    expect(result).toBe('Logo upload failed. Please try again.')
  })

  it('never throws when normalize rejects; returns an actionable message', async () => {
    const upload = vi.fn(async () => undefined)
    const normalize = async () => { throw new Error('cannot decode') }
    const result = await runLogoUpload(fakeFile('logo.heic', 100), deps({ upload, normalize }))
    expect(upload).not.toHaveBeenCalled()
    expect(result).toBe('Logo upload failed. Please try again.')
  })
})
