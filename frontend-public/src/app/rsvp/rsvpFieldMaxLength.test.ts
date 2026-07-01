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
// Each assertion fails on the pre-fix source and passes after.
function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('RSVP form text-field maxLength #156', () => {
  const src = read('app/rsvp/[token]/RsvpForm.tsx')

  it('caps the +1 guest name at the backend plusOneName limit (200)', () => {
    const block = src.slice(src.indexOf('value={plusOne}'))
    expect(block).toContain('maxLength={200}')
  })

  it('caps the primary dietary field at the backend dietaryRestrictions limit (500)', () => {
    const block = src.slice(src.indexOf('value={dietary}'))
    expect(block).toContain('maxLength={500}')
  })

  it('caps the primary song field at the backend songRequest limit (200)', () => {
    const block = src.slice(src.indexOf('value={song}'))
    expect(block).toContain('maxLength={200}')
  })

  it('caps each party-member dietary field at the backend limit (500)', () => {
    const block = src.slice(src.indexOf('value={partyDietary[m.guestId]'))
    expect(block).toContain('maxLength={500}')
  })

  it('caps each party-member song field at the backend limit (200)', () => {
    const block = src.slice(src.indexOf('value={partySong[m.guestId]'))
    expect(block).toContain('maxLength={200}')
  })

  it('leaves every over-cappable text field with a maxLength (five inputs plus the note)', () => {
    const count = (src.match(/maxLength=\{/g) ?? []).length
    // plusOne, dietary, song, party dietary, party song, and the pre-existing note textarea.
    expect(count).toBeGreaterThanOrEqual(6)
  })
})
