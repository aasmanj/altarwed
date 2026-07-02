import { describe, it, expect, vi } from 'vitest'
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  FILE_TOO_LARGE_MESSAGE,
  PHOTO_TOO_LARGE_MESSAGE,
  uploadErrorMessage,
  runImageUpload,
  type ImageUploadDeps,
} from './upload'
import { MAX_PHOTO_BYTES } from '@/features/couple/photos/photoBatchUpload'

// Simulate an Axios error: axios hangs the parsed response body on err.response.
function axiosError(status: number, data?: unknown): unknown {
  return { isAxiosError: true, response: { status, data } }
}

// Build a File without allocating real bytes: the size is overridden directly so
// the over-limit case costs nothing (same trick photoBatchUpload/logoUpload use).
function fakeFile(name: string, size: number, type = 'image/jpeg'): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

function imageDeps(overrides: Partial<ImageUploadDeps> = {}): ImageUploadDeps {
  return {
    normalize: async f => f,
    upload: async () => undefined,
    ...overrides,
  }
}

// A Spring ProblemDetail as it arrives on the wire for a 400 rejection.
function problem(detail: string) {
  return {
    type: 'https://altarwed.com/problems/bad-request',
    title: 'Bad Request',
    status: 400,
    detail,
  }
}

describe('upload size constant', () => {
  it('is the unified 20 MB cap and its label agree', () => {
    expect(MAX_UPLOAD_BYTES).toBe(20 * 1024 * 1024)
    expect(MAX_UPLOAD_LABEL).toBe('20 MB')
  })

  it('is the single source the album cap reads from (no drift)', () => {
    // Regression guard for #93/#136: the album cap used to be a separate
    // 15 MB literal. It must now be exactly the shared constant.
    expect(MAX_PHOTO_BYTES).toBe(MAX_UPLOAD_BYTES)
  })
})

describe('uploadErrorMessage', () => {
  it('surfaces the backend ProblemDetail detail on a 400 (size / type / dimensions)', () => {
    // These are the service-level rejections from #130 that previously fell to
    // the generic message; the couple must see the real reason.
    const detail = 'Image dimensions exceed the maximum of 40 megapixels.'
    expect(uploadErrorMessage(axiosError(400, problem(detail)))).toBe(detail)
  })

  it('shows the size-cap message on a 413 (payload too large, #122)', () => {
    const msg = uploadErrorMessage(axiosError(413))
    expect(msg).toBe(FILE_TOO_LARGE_MESSAGE)
    expect(msg).toContain('20 MB')
  })

  it('shows a format message on a 415 (unsupported type)', () => {
    expect(uploadErrorMessage(axiosError(415))).toMatch(/JPEG, PNG, or WebP/)
  })

  it('prompts a refresh on 401/403 (session lapsed)', () => {
    expect(uploadErrorMessage(axiosError(401))).toMatch(/Session expired/)
    expect(uploadErrorMessage(axiosError(403))).toMatch(/Session expired/)
  })

  it('falls back for a network error (no response) or 5xx', () => {
    const fallback = 'Upload failed. Try again.'
    expect(uploadErrorMessage(new Error('Network Error'), fallback)).toBe(fallback)
    expect(uploadErrorMessage(axiosError(500), fallback)).toBe(fallback)
  })

  it('falls back when a 400 carries no usable detail', () => {
    const fallback = 'Upload failed. Try again.'
    expect(uploadErrorMessage(axiosError(400, { status: 400 }), fallback)).toBe(fallback)
    expect(uploadErrorMessage(axiosError(400, problem('   ')), fallback)).toBe(fallback)
  })
})

// The two entry points issue #186 fixes (vendor portfolio uploader and the
// wedding-party avatar hover-upload) both route through runImageUpload. Before
// the fix neither ran the shared client-side pre-check, so an oversize file was
// either sent on a doomed round trip or surfaced a generic "Upload failed"; a 413
// (no ProblemDetail detail) had no size hint at all. These are parameterized over
// both call sites' copy so the regression is asserted for both locations at once.
describe('runImageUpload (portfolio + wedding-party avatar pre-check, #186)', () => {
  const GENERIC = 'Upload failed. Please try again.'
  const callSites = [
    ['vendor portfolio', { tooLarge: PHOTO_TOO_LARGE_MESSAGE, uploadFailed: GENERIC }],
    ['wedding-party avatar', { tooLarge: PHOTO_TOO_LARGE_MESSAGE, uploadFailed: GENERIC }],
  ] as const

  it('uploads a valid file and reports success (null error)', async () => {
    const upload = vi.fn(async () => undefined)
    const result = await runImageUpload(
      fakeFile('photo.jpg', 100),
      imageDeps({ upload }),
      { tooLarge: PHOTO_TOO_LARGE_MESSAGE, uploadFailed: GENERIC },
    )
    expect(upload).toHaveBeenCalledTimes(1)
    expect(result).toBeNull()
  })

  for (const [label, copy] of callSites) {
    describe(label, () => {
      it('rejects an oversize file client-side with the specific size message, not a generic failure', async () => {
        const upload = vi.fn(async () => undefined)
        const result = await runImageUpload(fakeFile('huge.jpg', MAX_UPLOAD_BYTES + 1), imageDeps({ upload }), copy)
        // Never sent, and the message is the shared specific one (contains the cap).
        expect(upload).not.toHaveBeenCalled()
        expect(result).toBe(PHOTO_TOO_LARGE_MESSAGE)
        expect(result).toContain(MAX_UPLOAD_LABEL)
        expect(result).not.toBe(GENERIC)
      })

      it('size-checks the post-normalization file, not the picked file', async () => {
        // A small HEIC that balloons past the cap once transcoded to JPEG must be
        // rejected on its uploaded size, never sent.
        const upload = vi.fn(async () => undefined)
        const normalize = async () => fakeFile('photo.jpg', MAX_UPLOAD_BYTES + 1)
        const result = await runImageUpload(fakeFile('photo.heic', 100, 'image/heic'), imageDeps({ upload, normalize }), copy)
        expect(upload).not.toHaveBeenCalled()
        expect(result).toBe(PHOTO_TOO_LARGE_MESSAGE)
      })

      it('shows the size-cap message on a 413 (which carries no ProblemDetail detail)', async () => {
        const upload = vi.fn(async () => { throw axiosError(413) })
        const result = await runImageUpload(fakeFile('photo.jpg', 100), imageDeps({ upload }), copy)
        expect(result).toBe(FILE_TOO_LARGE_MESSAGE)
        expect(result).toContain(MAX_UPLOAD_LABEL)
        expect(result).not.toBe(GENERIC)
      })

      it('surfaces the backend ProblemDetail detail on a 400 (e.g. wrong type / dimensions)', async () => {
        const detail = 'Only JPEG, PNG, or WebP images are allowed.'
        const upload = vi.fn(async () => { throw axiosError(400, problem(detail)) })
        const result = await runImageUpload(fakeFile('photo.gif', 100, 'image/gif'), imageDeps({ upload }), copy)
        expect(result).toBe(detail)
        expect(result).not.toBe(GENERIC)
      })

      it('shows the format message on a 415 (unsupported type), not a generic failure', async () => {
        const upload = vi.fn(async () => { throw axiosError(415) })
        const result = await runImageUpload(fakeFile('photo.gif', 100, 'image/gif'), imageDeps({ upload }), copy)
        expect(result).toMatch(/JPEG, PNG, or WebP/)
        expect(result).not.toBe(GENERIC)
      })

      it('falls back to the caller message on a network error / 5xx', async () => {
        const upload = vi.fn(async () => { throw new Error('Network Error') })
        const result = await runImageUpload(fakeFile('photo.jpg', 100), imageDeps({ upload }), copy)
        expect(result).toBe(copy.uploadFailed)
      })

      it('never throws when normalize rejects; returns an actionable message', async () => {
        const upload = vi.fn(async () => undefined)
        const normalize = async () => { throw new Error('cannot decode') }
        const result = await runImageUpload(fakeFile('photo.heic', 100), imageDeps({ upload, normalize }), copy)
        expect(upload).not.toHaveBeenCalled()
        expect(result).toBe(copy.uploadFailed)
      })
    })
  }
})
