import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// These are source-level guards for issue #69 (RSVP flow mobile UX). vitest runs
// in a node environment here (no jsdom / testing-library), so rather than render
// the components we assert on the load-bearing Tailwind classes and the
// timezone-safe date helper. Each assertion fails on the pre-fix source and
// passes after, which is the behavioral contract for these CSS-only changes:
//   - search controls stack vertically on mobile (flex-col) and go row at sm:
//   - form controls default to >= 16px font so iOS Safari does not auto-zoom
//   - per-member and primary action buttons meet the 44px touch-target minimum
//   - find-wedding renders dates through the local-noon helper, not new Date()
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('RSVP mobile UX (issue #69)', () => {
  it('find-invitation search stacks vertically on mobile, row on sm+', () => {
    const src = read('app/wedding/[slug]/rsvp/FindInvitationWidget.tsx')
    // The search form must not be a bare horizontal flex (that crushed the input
    // to an unreadable width at 320-375px).
    expect(src).toContain('flex flex-col sm:flex-row gap-3')
    expect(src).not.toContain('onSubmit={handleSearch} className="flex gap-3"')
    // The Find Me button goes full-width when stacked.
    expect(src).toContain('w-full sm:w-auto')
  })

  it('RSVP-result and find-invitation buttons meet the 44px touch target', () => {
    const widget = read('app/wedding/[slug]/rsvp/FindInvitationWidget.tsx')
    // "RSVP Now" was px-5 py-2 (~36px); must be py-3 (~44px).
    expect(widget).not.toContain('px-5 py-2 text-sm')
    expect(widget).toContain('px-5 py-3 text-sm')
  })

  it('party-member and primary RSVP buttons declare a 44px minimum height', () => {
    const form = read('app/rsvp/[token]/RsvpForm.tsx')
    // Per-member Attending/Declining toggles were px-3 py-1.5 text-xs (~28px).
    expect(form).not.toContain('px-3 py-1.5 text-xs')
    // The attending/declining radios and party toggles all guarantee 44px.
    const min44 = form.match(/min-h-\[44px\]/g) ?? []
    expect(min44.length).toBeGreaterThanOrEqual(3)
    // Reminder-interval and yes/no buttons were py-2 (~36px); must be py-3.
    expect(form).not.toContain('flex-1 rounded-lg border py-2 text-sm')
  })

  it('RSVP form controls default to >= 16px to prevent iOS zoom, sm: downsizes', () => {
    const css = read('app/globals.css')
    // Global base rule sets every control to text-base (16px).
    expect(css).toMatch(/input,\s*textarea,\s*select\s*\{\s*@apply text-base;/)
    const form = read('app/rsvp/[token]/RsvpForm.tsx')
    // Explicit utility classes would otherwise override the base rule, so the
    // controls opt back down only at sm: (desktop), never below 16px on mobile.
    expect(form).toContain('text-base sm:text-sm')
    expect(form).toContain('text-base sm:text-xs')
    expect(form).not.toMatch(/text-\[#3b2f2f\] text-sm focus:border-\[#d4af6a\]/)
  })

  it('find-wedding uses the local-noon date helper, not raw new Date parsing', () => {
    const src = read('app/find-wedding/page.tsx')
    expect(src).toContain("import { formatShortDate } from '@/lib/date'")
    expect(src).toContain('formatShortDate(r.weddingDate)')
    // The off-by-one timezone parse must be gone.
    expect(src).not.toContain("new Date(dateStr + 'T00:00:00')")
    // Search controls also avoid sub-16px font on mobile.
    expect(src).toContain('text-base sm:text-sm')
  })
})
