import type { CreateGuestPayload, GuestSide } from './useGuests'

// Spreadsheet import parsing, extracted from ImportGuestsModal so it is unit
// testable without a DOM, a File, or the xlsx reader. The modal is a thin view
// over these pure functions.
//
// A ParsedRow holds only the fields the bulk-add endpoint (CreateGuestRequest)
// can actually persist. The app's own template (GUEST_SHEET_COLUMNS in
// GuestListPage) advertises three more columns that the create DTO does not
// accept, so they are deliberately NOT parsed here and cannot round-trip:
//   - Plus One Name  (no plusOneName on CreateGuestRequest)
//   - RSVP Status    (set by the guest via the public RSVP flow, not on create)
//   - Table #        (assigned via the dedicated seating endpoint, not on create)
export interface ParsedRow {
  name: string
  email?: string
  phone?: string
  side?: GuestSide
  dietaryRestrictions?: string
  notes?: string
  partyName?: string
  mailLine1?: string
  mailCity?: string
  mailState?: string
  mailZip?: string
  mailCountry?: string
  plusOneAllowed?: boolean
}

// Fields whose cell value is stored as a plain trimmed string. side and
// plusOneAllowed are handled separately because they need normalising.
type StringField = Exclude<keyof ParsedRow, 'side' | 'plusOneAllowed'>

// Case-insensitive, trimmed header -> field mapping. Each pattern list covers the
// exact header the app's own template emits (so a CSV exported from the guest list
// round-trips) plus common hand-typed variants. Unknown headers map to nothing and
// are ignored gracefully.
export const HEADER_MAP: { patterns: string[]; field: keyof ParsedRow }[] = [
  { patterns: ['name', 'full name', 'guest name', 'guest name(s)', 'guest names'], field: 'name' },
  { patterns: ['party', 'household', 'party/household', 'party name', 'group'], field: 'partyName' },
  { patterns: ['side', 'side (bride or groom)', 'bride or groom'], field: 'side' },
  { patterns: ['phone', 'phone number', 'phone #'], field: 'phone' },
  { patterns: ['email', 'email address'], field: 'email' },
  { patterns: ['street address', 'address', 'mailing address', 'address line 1', 'street', 'mail line 1'], field: 'mailLine1' },
  { patterns: ['city'], field: 'mailCity' },
  { patterns: ['state', 'province', 'state/province'], field: 'mailState' },
  { patterns: ['zip', 'zip code', 'zipcode', 'postal code', 'zip/postal code'], field: 'mailZip' },
  { patterns: ['country'], field: 'mailCountry' },
  { patterns: ['allowed plus one?', 'allowed plus one', 'plus one', 'plus one allowed', 'plus one?', '+1'], field: 'plusOneAllowed' },
  { patterns: ['dietary', 'dietary restrictions', 'dietary restriction'], field: 'dietaryRestrictions' },
  { patterns: ['notes'], field: 'notes' },
]

export function detectField(header: string): keyof ParsedRow | null {
  const h = header.trim().toLowerCase()
  for (const { patterns, field } of HEADER_MAP) {
    if (patterns.some(p => p === h)) return field
  }
  return null
}

export function normalizeSide(raw: string): GuestSide | undefined {
  const v = raw.trim().toUpperCase()
  if (v === 'BRIDE' || v === 'GROOM' || v === 'BOTH') return v
  if (v === 'B') return 'BRIDE'
  if (v === 'G') return 'GROOM'
  return undefined
}

// Parse a yes/no column into a boolean. Matches the template's exported "Yes"/"No"
// plus the common hand-entered forms. Anything else (blank, "no", "0", "false") is
// false, which is also the manual add-guest default.
export function parsePlusOne(raw: string): boolean {
  const v = raw.trim().toLowerCase()
  return v === 'yes' || v === 'y' || v === 'true' || v === '1'
}

// Pure mapper: raw sheet rows (header -> cell string) to ParsedRow[]. Rows without a
// name are dropped, the name column is required and anchors every guest record.
export function parseRows(rawRows: Record<string, string>[]): ParsedRow[] {
  if (rawRows.length === 0) return []

  // Build a column index from the first row's keys (the headers the reader extracts).
  const headers = Object.keys(rawRows[0])
  const colMap: { colKey: string; field: keyof ParsedRow }[] = []
  for (const colKey of headers) {
    const field = detectField(colKey)
    if (field) colMap.push({ colKey, field })
  }

  const rows: ParsedRow[] = []
  for (const row of rawRows) {
    const parsed: Partial<ParsedRow> = {}
    for (const { colKey, field } of colMap) {
      const val = String(row[colKey] ?? '').trim()
      if (!val) continue
      if (field === 'side') {
        parsed.side = normalizeSide(val)
      } else if (field === 'plusOneAllowed') {
        parsed.plusOneAllowed = parsePlusOne(val)
      } else {
        parsed[field as StringField] = val
      }
    }
    if (parsed.name) rows.push(parsed as ParsedRow)
  }
  return rows
}

export async function parseFile(file: File): Promise<ParsedRow[]> {
  const { read, utils } = await import('xlsx')
  const data = new Uint8Array(await file.arrayBuffer())
  const wb = read(data, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rawRows = utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
  return parseRows(rawRows)
}

// ParsedRow -> bulk-add payload. Empty strings collapse to undefined so the backend
// stores nulls rather than blanks; plusOneAllowed defaults to false when the column
// was absent or blank, matching the manual add-guest default.
export function toCreatePayload(row: ParsedRow): CreateGuestPayload {
  return {
    name: row.name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    side: row.side,
    dietaryRestrictions: row.dietaryRestrictions || undefined,
    notes: row.notes || undefined,
    partyName: row.partyName || undefined,
    mailLine1: row.mailLine1 || undefined,
    mailCity: row.mailCity || undefined,
    mailState: row.mailState || undefined,
    mailZip: row.mailZip || undefined,
    mailCountry: row.mailCountry || undefined,
    plusOneAllowed: row.plusOneAllowed ?? false,
  }
}
