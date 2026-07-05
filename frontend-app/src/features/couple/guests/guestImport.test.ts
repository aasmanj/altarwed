import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { detectField, parsePlusOne, parseRows, toCreatePayload } from './guestImport'

// Behavioral contract for issue #223 (CSV/Excel column parity). Before the fix the
// HEADER_MAP covered only 6 columns and hardcoded plusOneAllowed to false, so a CSV
// exported from the app's own 16-column template silently dropped addresses, party,
// and plus-one. These tests exercise the pure parsing layer directly (no xlsx / no DOM).

// The exact headers the app's own template emits (GUEST_SHEET_COLUMNS in GuestListPage),
// minus the three the create DTO cannot accept and that therefore cannot round-trip.
const MAPPABLE_TEMPLATE_HEADERS: { header: string; field: string }[] = [
  { header: 'Guest Name(s)', field: 'name' },
  { header: 'Party', field: 'partyName' },
  { header: 'Side (Bride or Groom)', field: 'side' },
  { header: 'Phone Number', field: 'phone' },
  { header: 'Email Address', field: 'email' },
  { header: 'Street Address', field: 'mailLine1' },
  { header: 'City', field: 'mailCity' },
  { header: 'State', field: 'mailState' },
  { header: 'Zip Code', field: 'mailZip' },
  { header: 'Country', field: 'mailCountry' },
  { header: 'Allowed Plus One?', field: 'plusOneAllowed' },
  { header: 'Dietary Restriction', field: 'dietaryRestrictions' },
  { header: 'Notes', field: 'notes' },
]

// Columns the template advertises but the bulk create DTO cannot persist, so import
// must NOT invent a mapping for them (they are ignored, documented in the PR body).
const NON_ROUNDTRIP_HEADERS = ['Plus One Name', 'RSVP Status', 'Table #', 'AltarWed ID (do not modify)']

describe('guest import header mapping (#223)', () => {
  it('maps every mappable template header to its field', () => {
    for (const { header, field } of MAPPABLE_TEMPLATE_HEADERS) {
      expect(detectField(header), header).toBe(field)
    }
  })

  it('matches headers case-insensitively and trims surrounding whitespace', () => {
    expect(detectField('  street address  ')).toBe('mailLine1')
    expect(detectField('EMAIL ADDRESS')).toBe('email')
    expect(detectField('Zip Code')).toBe('mailZip')
    expect(detectField('ALLOWED PLUS ONE?')).toBe('plusOneAllowed')
  })

  it('tolerates common hand-typed header variants', () => {
    expect(detectField('household')).toBe('partyName')
    expect(detectField('address')).toBe('mailLine1')
    expect(detectField('postal code')).toBe('mailZip')
    expect(detectField('province')).toBe('mailState')
    expect(detectField('plus one')).toBe('plusOneAllowed')
  })

  it('returns null for unknown columns so they are ignored', () => {
    for (const header of NON_ROUNDTRIP_HEADERS) {
      expect(detectField(header), header).toBeNull()
    }
    expect(detectField('favourite hymn')).toBeNull()
  })

  it('parses Allowed Plus One as a boolean (yes/true/1/y -> true, case-insensitive)', () => {
    for (const truthy of ['Yes', 'yes', 'TRUE', 'true', '1', 'y', 'Y']) {
      expect(parsePlusOne(truthy), truthy).toBe(true)
    }
    for (const falsy of ['No', 'no', 'false', '0', '', '  ', 'maybe']) {
      expect(parsePlusOne(falsy), falsy).toBe(false)
    }
  })

  it('round-trips a full template row: every mappable column survives into the payload', () => {
    const rows = parseRows([
      {
        'Guest Name(s)': 'Andrew Smith',
        'Party': 'Smith Household',
        'Side (Bride or Groom)': 'Groom',
        'Phone Number': '555-1234',
        'Email Address': 'andrew@example.com',
        'Street Address': '12 Chapel Lane',
        'City': 'Austin',
        'State': 'TX',
        'Zip Code': '78701',
        'Country': 'USA',
        'Allowed Plus One?': 'Yes',
        'Plus One Name': 'Jamie',
        'RSVP Status': 'ATTENDING',
        'Table #': '4',
        'Dietary Restriction': 'Vegetarian',
        'Notes': 'College friend',
        'AltarWed ID (do not modify)': 'abc-123',
      },
    ])

    expect(rows).toHaveLength(1)
    const payload = toCreatePayload(rows[0])
    expect(payload).toEqual({
      name: 'Andrew Smith',
      partyName: 'Smith Household',
      side: 'GROOM',
      phone: '555-1234',
      email: 'andrew@example.com',
      mailLine1: '12 Chapel Lane',
      mailCity: 'Austin',
      mailState: 'TX',
      mailZip: '78701',
      mailCountry: 'USA',
      plusOneAllowed: true,
      dietaryRestrictions: 'Vegetarian',
      notes: 'College friend',
    })
    // The address survives, which is the round-trip that makes an imported guest appear
    // in the postcard recipient list (CommunicationsPage filters on mailLine1).
    expect(payload.mailLine1).toBe('12 Chapel Lane')
  })

  it('defaults plusOneAllowed to false when the column is absent, and drops nameless rows', () => {
    const rows = parseRows([
      { 'Guest Name(s)': 'Solo Guest', 'Email Address': 'solo@example.com' },
      { 'Guest Name(s)': '', 'Email Address': 'ghost@example.com' },
    ])
    expect(rows).toHaveLength(1)
    expect(toCreatePayload(rows[0]).plusOneAllowed).toBe(false)
  })

  it('ignores unknown columns without polluting the payload', () => {
    const rows = parseRows([
      { 'Guest Name(s)': 'Mara', 'Favourite Hymn': 'How Great Thou Art', 'Table #': '9' },
    ])
    const payload = toCreatePayload(rows[0])
    expect(payload.name).toBe('Mara')
    expect(Object.keys(payload)).not.toContain('Favourite Hymn')
    expect(Object.keys(payload)).not.toContain('tableNumber')
  })
})

// Source-level accessibility guards for issue #235. vitest runs in a node environment
// here (no jsdom / testing-library), so rather than render the modal we assert on the
// load-bearing JSX. Each assertion fails on the pre-fix source and passes after.
function readModal(): string {
  return readFileSync(path.join(process.cwd(), 'src/features/couple/guests/ImportGuestsModal.tsx'), 'utf8')
}

describe('ImportGuestsModal accessibility (#235)', () => {
  it('wires useModalA11y (focus in on open, Escape closes, focus restored on close)', () => {
    const src = readModal()
    expect(src).toContain("import { useModalA11y } from '@/lib/useModalA11y'")
    expect(src).toContain('useModalA11y<HTMLDivElement>(true, onClose)')
    // The hook container ref must sit on the dialog element it manages.
    expect(src).toMatch(/ref=\{dialogRef\}[\s\S]*role="dialog"/)
  })

  it('drops the div-as-button dropzone in favour of a native button', () => {
    const src = readModal()
    // The old anti-pattern (role="button" + manual Enter/Space keydown) is gone.
    expect(src).not.toContain('role="button"')
    expect(src).not.toContain("role=\"presentation\"")
    // Drag-and-drop handlers stay on the wrapper; the click affordance is a real button.
    expect(src).toMatch(/onDrop=\{handleDrop\}/)
    expect(src).toMatch(/<button\s+type="button"\s+onClick=\{\(\) => inputRef\.current\?\.click\(\)\}/)
  })
})
