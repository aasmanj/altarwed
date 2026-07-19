import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { buildInquiryBody } from './InquiryForm'

// Issue #100: the public inquiry endpoint queues two emails per accepted call, so
// it now carries a Cloudflare Turnstile token (verified server-side, same adapter
// as the RSVP find path from issue #89) and the backend enforces a per-vendor
// send cap. vitest runs in a node environment here (no jsdom), so the pure
// buildInquiryBody contract is asserted directly and the widget wiring is pinned
// with source-level assertions, mirroring findInvitation.test.ts.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

const fields = {
  vendorId: 'f2b9d0d6-1234-4c9a-9e1a-000000000001',
  name: '  Jordan & Eden ',
  email: ' couple@example.com ',
  weddingDate: ' October 2026 ',
  message: '  We would love to learn more.  ',
}

describe('buildInquiryBody (issue #100)', () => {
  it('includes captchaToken when a token is present, alongside trimmed fields', () => {
    const body = buildInquiryBody(fields, 'tok_123')
    expect(body).toEqual({
      vendorId: fields.vendorId,
      coupleName: 'Jordan & Eden',
      coupleEmail: 'couple@example.com',
      weddingDate: 'October 2026',
      message: 'We would love to learn more.',
      captchaToken: 'tok_123',
    })
  })

  it('omits captchaToken entirely (not an empty string) when no token exists', () => {
    // Distinguishes "Turnstile not configured / not yet resolved" from "explicitly
    // sent an empty token": while Turnstile is unconfigured the backend verifies
    // everything, and an explicit empty field would read worse in server logs.
    const body = buildInquiryBody(fields, '')
    expect('captchaToken' in body).toBe(false)
  })

  it('sends null, not an empty string, for a blank optional wedding date', () => {
    const body = buildInquiryBody({ ...fields, weddingDate: '   ' }, 'tok_123')
    expect(body.weddingDate).toBeNull()
  })
})

describe('InquiryForm wiring (issue #100)', () => {
  const src = read('app/vendors/[id]/InquiryForm.tsx')

  it('uses the shared useTurnstile hook and renders its widget slot', () => {
    // One Turnstile implementation for the whole site: the subtle mechanics
    // (single-use reset, bounded ready-gate, never-re-latch guard) live in
    // lib/useTurnstile.tsx, shared with the RSVP find widget (issue #89).
    expect(src).toContain("from '@/lib/useTurnstile'")
    expect(src).toContain('{turnstileSlot}')
  })

  it('sends the captcha token with the inquiry payload', () => {
    expect(src).toContain('buildInquiryBody({ vendorId, name, email, weddingDate, message }, captchaToken)')
  })

  it('disables the submit button until a captcha token is ready', () => {
    expect(src).toContain('|| waitingOnCaptcha')
  })

  it('shows a visible status while waiting on the captcha, not a silent disabled button', () => {
    expect(src).toContain("Verifying you&apos;re human...")
    expect(src).toContain('role="status"')
  })

  it('resets the single-use captcha token after rejected attempts so a retry can succeed', () => {
    expect(src).toContain('resetCaptcha()')
  })
})
