import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  detectField,
  parsePlusOne,
  parseRows,
  toCreatePayload,
  findDuplicates,
  normalizeName,
  MAX_IMPORT_ROWS,
  type ParsedRow,
  type ExistingGuestKey,
} from './guestImport'

// Behavioral contract for issue #223 (CSV/Excel column parity). Before the fix the
// HEADER_MAP covered only 6 columns and hardcoded plusOneAllowed to false, so a CSV
// exported from the app's own 16-column template silently dropped addresses, party,
// and plus-one. These tests exercise the pure parsing layer directly (no xlsx / no DOM).

// The exact headers the app's own template emits (GUEST_SHEET_COLUMNS in GuestListPage).
// All 16 data columns now round-trip through import (#264).
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
  { header: 'Plus One Name', field: 'plusOneName' },
  { header: 'RSVP Status', field: 'rsvpStatus' },
  { header: 'Table #', field: 'tableNumber' },
  { header: 'Dietary Restriction', field: 'dietaryRestrictions' },
  { header: 'Notes', field: 'notes' },
]

// Only the export-only column has no import mapping (it is a Google-Sheets-sync key,
// never accepted by the bulk-add DTO).
const NON_ROUNDTRIP_HEADERS = ['AltarWed ID (do not modify)']

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

  it('round-trips a full template row: all 16 columns survive into the payload (#264)', () => {
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
      plusOneName: 'Jamie',
      rsvpStatus: 'ATTENDING',
      tableNumber: 4,
      dietaryRestrictions: 'Vegetarian',
      notes: 'College friend',
    })
    // The address survives, making an imported guest appear in the postcard recipient list
    // (CommunicationsPage filters on mailLine1).
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
      { 'Guest Name(s)': 'Mara', 'Favourite Hymn': 'How Great Thou Art' },
    ])
    const payload = toCreatePayload(rows[0])
    expect(payload.name).toBe('Mara')
    expect(Object.keys(payload)).not.toContain('Favourite Hymn')
  })

  it('parses Table # as a positive integer and ignores non-numeric or zero values', () => {
    const withTable = parseRows([{ 'Guest Name(s)': 'Tim', 'Table #': '7' }])
    expect(toCreatePayload(withTable[0]).tableNumber).toBe(7)

    const zeroTable = parseRows([{ 'Guest Name(s)': 'Tim', 'Table #': '0' }])
    expect(toCreatePayload(zeroTable[0]).tableNumber).toBeUndefined()

    const badTable = parseRows([{ 'Guest Name(s)': 'Tim', 'Table #': 'window seat' }])
    expect(toCreatePayload(badTable[0]).tableNumber).toBeUndefined()
  })

  it('parses RSVP Status case-insensitively and ignores unknown values', () => {
    const attending = parseRows([{ 'Guest Name(s)': 'Kim', 'RSVP Status': 'attending' }])
    expect(toCreatePayload(attending[0]).rsvpStatus).toBe('ATTENDING')

    const pending = parseRows([{ 'Guest Name(s)': 'Kim', 'RSVP Status': 'PENDING' }])
    expect(toCreatePayload(pending[0]).rsvpStatus).toBe('PENDING')

    const unknown = parseRows([{ 'Guest Name(s)': 'Kim', 'RSVP Status': 'maybe later' }])
    expect(toCreatePayload(unknown[0]).rsvpStatus).toBeUndefined()
  })
})

// Duplicate detection (#226). Before the fix, import mapped rows straight to bulk
// add with no matching, so a couple who re-imported a tweaked sheet duplicated the
// entire guest list. These exercise the pure matcher directly.
const row = (name: string, email?: string): ParsedRow => ({ name, email, plusOneAllowed: false })

describe('guest import duplicate detection (#226)', () => {
  it('normalizes names by trimming, collapsing internal whitespace, and lowercasing', () => {
    expect(normalizeName('  Mary   Jane ')).toBe('mary jane')
    expect(normalizeName('MARY JANE')).toBe('mary jane')
    expect(normalizeName('Mary\tJane')).toBe('mary jane')
  })

  it('flags a row whose email matches an existing guest (case-insensitively)', () => {
    const existing: ExistingGuestKey[] = [{ name: 'Someone Else', email: 'Andrew@Example.com' }]
    const report = findDuplicates([row('Different Name', 'andrew@example.com')], existing)
    expect(report.reasons).toEqual(['existing'])
    expect(report.existingCount).toBe(1)
    expect(report.inFileCount).toBe(0)
  })

  it('flags a row whose normalized name matches an existing guest even with different spacing/case', () => {
    const existing: ExistingGuestKey[] = [{ name: 'Mary Jane', email: null }]
    const report = findDuplicates([row('  mary   JANE ', 'new@example.com')], existing)
    expect(report.reasons).toEqual(['existing'])
    expect(report.existingCount).toBe(1)
  })

  it('leaves genuinely new rows unflagged', () => {
    const existing: ExistingGuestKey[] = [{ name: 'Andrew Smith', email: 'andrew@example.com' }]
    const report = findDuplicates([row('Brand New', 'brand@example.com')], existing)
    expect(report.reasons).toEqual([null])
    expect(report.existingCount).toBe(0)
    expect(report.inFileCount).toBe(0)
  })

  it('detects duplicates WITHIN the file itself (by email or name)', () => {
    const report = findDuplicates(
      [
        row('Andrew Smith', 'andrew@example.com'),
        row('Andrew Smith', 'andrew@example.com'), // same email + name
        row('Different Label', 'andrew@example.com'), // same email, new name
        row('andrew smith', 'other@example.com'), // same name, new email
      ],
      []
    )
    expect(report.reasons).toEqual([null, 'in-file', 'in-file', 'in-file'])
    expect(report.inFileCount).toBe(3)
    expect(report.existingCount).toBe(0)
  })

  it('classifies an existing-list match ahead of an in-file match', () => {
    const existing: ExistingGuestKey[] = [{ name: 'Andrew Smith', email: 'andrew@example.com' }]
    const report = findDuplicates(
      [row('Andrew Smith', 'andrew@example.com'), row('Andrew Smith', 'andrew@example.com')],
      existing
    )
    expect(report.reasons).toEqual(['existing', 'existing'])
    expect(report.existingCount).toBe(2)
    expect(report.inFileCount).toBe(0)
  })

  it('never matches empty-email rows to each other on email (only names can match)', () => {
    const report = findDuplicates(
      [row('Aunt Ruth', ''), row('Uncle Ray', ''), row('Cousin Bea')],
      [{ name: 'Grandma Joy', email: '' }]
    )
    // Three distinct names, all blank email: nothing collapses.
    expect(report.reasons).toEqual([null, null, null])
    expect(report.existingCount).toBe(0)
    expect(report.inFileCount).toBe(0)
  })

  it('still matches blank-email rows when the NAME repeats', () => {
    const report = findDuplicates([row('Aunt Ruth', ''), row('aunt ruth', '')], [])
    expect(report.reasons).toEqual([null, 'in-file'])
    expect(report.inFileCount).toBe(1)
  })
})

describe('guest import row-count guard (#226)', () => {
  it('exposes the 500 per-import cap so the modal can guard before any network call', () => {
    expect(MAX_IMPORT_ROWS).toBe(500)
  })

  it('a 600-row sheet parses to more rows than the cap (the over-limit trigger)', () => {
    const rawRows = Array.from({ length: 600 }, (_, i) => ({ 'Guest Name(s)': `Guest ${i}` }))
    const rows = parseRows(rawRows)
    expect(rows).toHaveLength(600)
    expect(rows.length > MAX_IMPORT_ROWS).toBe(true)
  })
})

// Source-level accessibility guards for issue #235. vitest runs in a node environment
// here (no jsdom / testing-library), so rather than render the modal we assert on the
// load-bearing JSX. Each assertion fails on the pre-fix source and passes after.
function readModal(): string {
  return readFileSync(path.join(process.cwd(), 'src/features/couple/guests/ImportGuestsModal.tsx'), 'utf8')
}

describe('ImportGuestsModal accessibility (#235)', () => {
  it('wires useModalA11y (focus in on open, Escape closes, focus restored on close) via the shared AnimatedModal wrapper (#301)', () => {
    const src = readModal()
    // Issue #301 moved the modal chrome (backdrop, panel, useModalA11y wiring)
    // into the shared <AnimatedModal>; ImportGuestsModal itself now only
    // supplies its content and closes through the wrapper's onClose.
    expect(src).toContain("import { AnimatedModal } from '@/components/AnimatedModal'")
    expect(src).toContain('<AnimatedModal')
    expect(src).toContain('onClose={onClose}')
    // AnimatedModal itself is the source of truth for the useModalA11y wiring;
    // guarded directly in AnimatedModal.test.ts.
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
