import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { classifySubmitError } from '@/app/rsvp/[token]/RsvpForm'

// Guards for issue #307 (public RSVP polish). vitest runs in a node environment
// here (no jsdom / testing-library), matching the sibling rsvp tests, so the
// pure classifySubmitError contract is asserted behaviorally and the rendered
// copy / motion CSS via source-level wiring assertions. Before the fix, every
// submit failure collapsed into one generic "Something went wrong" with no
// recovery link, conditional sections snapped in with a layout jump, and
// globals.css forced smooth scrolling on reduced-motion users.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('classifySubmitError (issue #307)', () => {
  it('classifies the backend invalid/consumed-token 400 as invalidToken', () => {
    // GlobalExceptionHandler maps InvalidRsvpTokenException to 400.
    expect(classifySubmitError(400)).toBe('invalidToken')
  })

  it('classifies 404 and 410 defensively as invalidToken too', () => {
    expect(classifySubmitError(404)).toBe('invalidToken')
    expect(classifySubmitError(410)).toBe('invalidToken')
  })

  it('classifies a Bucket4j 429 as rateLimited, never invalidToken', () => {
    expect(classifySubmitError(429)).toBe('rateLimited')
  })

  it('keeps 5xx and network failures (null status) as unknown', () => {
    expect(classifySubmitError(500)).toBe('unknown')
    expect(classifySubmitError(503)).toBe('unknown')
    expect(classifySubmitError(null)).toBe('unknown')
  })
})

describe('RSVP submit error rendering (issue #307)', () => {
  const form = read('app/rsvp/[token]/RsvpForm.tsx')

  it('branches the copy by error kind instead of one generic message', () => {
    expect(form).toContain('This RSVP link is no longer valid. It may have expired or already been used.')
    expect(form).toContain('Too many attempts from your network. Please wait a minute and try again.')
    // Generic copy is retained, but only for the unknown branch.
    expect(form).toContain('Something went wrong. Please try again or contact the couple directly.')
    expect(form).toContain("error === 'invalidToken'")
    expect(form).toContain("error === 'rateLimited'")
  })

  it('classifies via the shared pure function on both non-ok and thrown paths', () => {
    expect(form).toContain('classifySubmitError(res.status)')
    expect(form).toContain('classifySubmitError(null)')
    // The old collapse-everything throw must be gone.
    expect(form).not.toContain("throw new Error('Failed')")
  })

  it('shows the find-your-invitation recovery link on EVERY error state', () => {
    // One shared href powers the confirmation screen and the error alert.
    expect(form).toContain('findInvitationHref')
    // The link appears in the error alert unconditionally (both the invalid-token
    // lead-in and the lost-your-link lead-in end at the same finder link).
    expect(form).toContain("error === 'invalidToken' ? 'Get a fresh link: ' : 'Lost your link? '")
    const finderLinks = form.match(/Find your invitation/g) ?? []
    expect(finderLinks.length).toBeGreaterThanOrEqual(2)
    // Wedding-scoped finder when the slug is known, name search otherwise.
    expect(form).toContain('`/wedding/${weddingSlug}/rsvp`')
    expect(form).toContain("'/find-wedding'")
  })

  it('keeps the existing robustness: disabled-while-pending and role=alert', () => {
    expect(form).toContain('disabled={!isReady || submitting}')
    expect(form).toContain('role="alert"')
  })
})

describe('RSVP motion polish (issue #307)', () => {
  const form = read('app/rsvp/[token]/RsvpForm.tsx')
  const css = read('app/globals.css')

  it('conditional sections carry the motion-safe expand transition', () => {
    // Plus-one, attending-only fields, custom questions, note, party block,
    // per-member fields, and the reminder-interval row all animate in.
    const expands = form.match(/rsvp-expand-in/g) ?? []
    expect(expands.length).toBeGreaterThanOrEqual(7)
  })

  it('post-submit swap fades in rather than jump-cutting', () => {
    expect(form).toContain('rsvp-fade-in')
  })

  it('the transitions are CSS-only and gated on prefers-reduced-motion: no-preference', () => {
    const motionBlock = css.slice(css.indexOf('.rsvp-expand-in'))
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)')
    expect(motionBlock).toContain('@keyframes rsvp-expand-in')
    expect(motionBlock).toContain('@keyframes rsvp-fade-in')
    // The gate must precede the utility classes so reduced-motion users get
    // instant appearance (the classes simply do not exist for them).
    const gateIdx = css.lastIndexOf(
      '@media (prefers-reduced-motion: no-preference)',
      css.indexOf('.rsvp-expand-in'),
    )
    expect(gateIdx).toBeGreaterThan(-1)
  })

  it('smooth scroll honors reduced motion and the dead scroll keyframes are gone', () => {
    // scroll-behavior: smooth must live inside a no-preference media query.
    const scrollIdx = css.indexOf('scroll-behavior: smooth')
    expect(scrollIdx).toBeGreaterThan(-1)
    const gateIdx = css.lastIndexOf('@media (prefers-reduced-motion: no-preference)', scrollIdx)
    expect(gateIdx).toBeGreaterThan(-1)
    // The unused marquee-style keyframes rule is deleted.
    expect(css).not.toContain('@keyframes scroll {')
    expect(css).not.toContain('translateX(-50%)')
  })

  it('uses no em dashes in the new copy', () => {
    for (const src of [form, css]) {
      expect(src).not.toContain('—')
    }
  })
})
