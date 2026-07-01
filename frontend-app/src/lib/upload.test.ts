import { describe, it, expect } from 'vitest'
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  FILE_TOO_LARGE_MESSAGE,
  uploadErrorMessage,
} from './upload'
import { MAX_PHOTO_BYTES } from '@/features/couple/photos/photoBatchUpload'

// Simulate an Axios error: axios hangs the parsed response body on err.response.
function axiosError(status: number, data?: unknown): unknown {
  return { isAxiosError: true, response: { status, data } }
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
