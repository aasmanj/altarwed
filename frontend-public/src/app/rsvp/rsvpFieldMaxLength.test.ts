import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guard for issue #156. The RSVP form's free-text fields had no
// client-side length cap, so a guest who pasted an over-long value hit a clean
// backend 400 but a generic "Something went wrong" dead-end with no hint why.
// vitest runs in a node environment here (no jsdom / testing-library), so we
// assert on the load-bearing JSX rather than rendering. Each maxLength must match
// the backend's Bean Validation @Size cap for the corresponding field, which in
// turn matches the DB column size:
//   SubmitRsvpRequest: plusOneName @Size(max=200), dietaryRestrictions @Size(max=500),
//                      songRequest @Size(max=200)
//   PartyMemberResponse: dietaryRestrictions @Size(max=500), songRequest @Size(max=200)
//   CustomAnswerSubmission: answerText @Size(max=2000)
// Each assertion fails on the pre-fix source and passes after.
//
// Each slice is bounded to the field's own closing `/>` (start index -> next `/>`),
// not run to end-of-file. An unbounded slice would let a later field that shares the
// same maxLength value mask a removed cap on an earlier field (false positive).
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

// The JSX of a single self-closing input, from its `value={...}` anchor to the
// first `/>` after it. Pass a start offset to target a specific occurrence.
function inputBlock(src: string, anchor: string, from = 0): string {
  const idx = src.indexOf(anchor, from)
  return src.slice(idx, src.indexOf('/>', idx))
}

describe('RSVP form text-field maxLength #156', () => {
  const src = read('app/rsvp/[token]/RsvpForm.tsx')

  it('caps the +1 guest name at the backend plusOneName limit (200)', () => {
    expect(inputBlock(src, 'value={plusOne}')).toContain('maxLength={200}')
  })

  it('caps the primary dietary field at the backend dietaryRestrictions limit (500)', () => {
    expect(inputBlock(src, 'value={dietary}')).toContain('maxLength={500}')
  })

  it('caps the primary song field at the backend songRequest limit (200)', () => {
    expect(inputBlock(src, 'value={song}')).toContain('maxLength={200}')
  })

  it('caps each party-member dietary field at the backend limit (500)', () => {
    expect(inputBlock(src, 'value={partyDietary[m.guestId]')).toContain('maxLength={500}')
  })

  it('caps each party-member song field at the backend limit (200)', () => {
    expect(inputBlock(src, 'value={partySong[m.guestId]')).toContain('maxLength={200}')
  })

  it('caps the custom-question free-text answer at the backend answerText limit (2000)', () => {
    // The CHOICE `<select>` (options-constrained, needs no cap) and the free-text
    // `<input>` both bind `value={val}`; the select renders first in source order, so
    // the free-text input is the last occurrence.
    const block = inputBlock(src, 'value={val}', src.lastIndexOf('value={val}'))
    expect(block).toContain('maxLength={2000}')
  })

  it('leaves every over-cappable text field with a maxLength (six inputs plus the note)', () => {
    const count = (src.match(/maxLength=\{/g) ?? []).length
    // plusOne, dietary, song, party dietary, party song, custom answer, and the note textarea.
    expect(count).toBeGreaterThanOrEqual(7)
  })
})
