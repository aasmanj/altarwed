import type { CreateGuestPayload, GuestSide, RsvpStatus } from './useGuests'

// Spreadsheet import parsing, extracted from ImportGuestsModal so it is unit
// testable without a DOM or a File. The modal is a thin view over these functions.
// .xlsx files are read with exceljs and .csv with papaparse (both lazy-loaded);
// the unmaintained SheetJS `xlsx` package was removed in issue #99 because the
// npm-registry build carries unfixed HIGH advisories (prototype pollution + ReDoS)
// and this parser runs on user-supplied files.
//
// ParsedRow holds all fields the bulk-add endpoint (CreateGuestRequest) can persist,
// including the three that were previously skipped: plusOneName, rsvpStatus, tableNumber.
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
  plusOneName?: string
  rsvpStatus?: RsvpStatus
  tableNumber?: number
}

// Fields whose cell value is stored as a plain trimmed string. side, plusOneAllowed,
// rsvpStatus, and tableNumber are handled separately (need normalising or parsing).
type StringField = Exclude<keyof ParsedRow, 'side' | 'plusOneAllowed' | 'rsvpStatus' | 'tableNumber'>

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
  { patterns: ['plus one name', 'plus-one name', "plus one's name", 'guest plus one name'], field: 'plusOneName' },
  { patterns: ['rsvp status', 'rsvp', 'status'], field: 'rsvpStatus' },
  { patterns: ['table #', 'table number', 'table', 'table no', 'table no.'], field: 'tableNumber' },
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
      } else if (field === 'rsvpStatus') {
        const v = val.trim().toUpperCase()
        if (v === 'PENDING' || v === 'ATTENDING' || v === 'DECLINING') {
          parsed.rsvpStatus = v as RsvpStatus
        }
      } else if (field === 'tableNumber') {
        const n = parseInt(val, 10)
        if (!isNaN(n) && n >= 1) parsed.tableNumber = n
      } else {
        parsed[field as StringField] = val
      }
    }
    if (parsed.name) rows.push(parsed as ParsedRow)
  }
  return rows
}

// Per-import row cap the backend enforces (CreateGuestBulkRequest @Size(max=500)).
// We check it client-side too so a couple with a 600-row sheet gets a specific,
// actionable message before any network call instead of a generic "Import failed".
export const MAX_IMPORT_ROWS = 500

// Minimal shape of an already-saved guest the duplicate matcher needs. Kept
// narrow (not the full Guest type) so this layer stays pure and unit-testable
// without react-query or the API client.
export interface ExistingGuestKey {
  name: string
  email?: string | null
}

// Why a parsed row was flagged: it matches a guest already on the list, or an
// earlier row in the same file. Drives the wording in the preview.
export type DuplicateReason = 'existing' | 'in-file'

export interface DuplicateReport {
  // Parallel to the parsed rows: the reason each row was flagged, or null when
  // the row looks new. Index-aligned so the preview can mark individual rows.
  reasons: (DuplicateReason | null)[]
  // Rows that match someone already on the guest list.
  existingCount: number
  // Rows that repeat an earlier row inside this same file.
  inFileCount: number
}

// Normalize a full name for duplicate comparison: trim the ends, collapse any run
// of internal whitespace to a single space, and lowercase. So "  Mary   Jane " and
// "mary jane" compare equal. Deliberately conservative (no accent folding) so we
// only warn on near-certain matches.
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

// Normalize an email for comparison: trim and lowercase. Empty/whitespace-only
// becomes '' so callers can treat "no email" as never-matching.
export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase()
}

// Pure duplicate matcher. A parsed row is a likely duplicate when either:
//   - its email matches an existing guest's email (case-insensitive, both non-empty), or
//   - its normalized full name matches an existing guest's normalized name.
// The same two keys also detect repeats WITHIN the file: an earlier parsed row
// counts as the "existing" side for the rows that follow it. Empty emails never
// match each other (only names can match when the email is blank), so a sheet of
// address-less guests is not collapsed into one.
export function findDuplicates(rows: ParsedRow[], existing: ExistingGuestKey[]): DuplicateReport {
  const existingEmails = new Set<string>()
  const existingNames = new Set<string>()
  for (const g of existing) {
    const email = normalizeEmail(g.email)
    if (email) existingEmails.add(email)
    const name = normalizeName(g.name)
    if (name) existingNames.add(name)
  }

  // Keys seen in earlier rows of this same file, so a later row can match them.
  const seenEmails = new Set<string>()
  const seenNames = new Set<string>()

  const reasons: (DuplicateReason | null)[] = []
  let existingCount = 0
  let inFileCount = 0

  for (const row of rows) {
    const email = normalizeEmail(row.email)
    const name = normalizeName(row.name)

    const matchesExisting =
      (email !== '' && existingEmails.has(email)) || (name !== '' && existingNames.has(name))
    const matchesInFile =
      (email !== '' && seenEmails.has(email)) || (name !== '' && seenNames.has(name))

    let reason: DuplicateReason | null = null
    if (matchesExisting) {
      reason = 'existing'
      existingCount++
    } else if (matchesInFile) {
      reason = 'in-file'
      inFileCount++
    }
    reasons.push(reason)

    // Record this row's keys after classifying it, so it can be the match target
    // for the rows that come after.
    if (email) seenEmails.add(email)
    if (name) seenNames.add(name)
  }

  return { reasons, existingCount, inFileCount }
}

// Hard cap on the uploaded file itself, checked before any parsing (issue #99:
// validate and cap imported file size). 500 guests fits in well under 1 MB even as
// a bloated .xlsx; 10 MB leaves headroom while keeping a hostile or accidental
// 500 MB upload from ever reaching the parser.
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024

// A parse failure with a message written for the couple, not the console. The
// modal shows err.message verbatim when it catches one of these, and falls back
// to its generic "could not read the file" copy for anything else.
export class ImportFileError extends Error {}

// File-signature sniffing. An .xlsx is a ZIP container ("PK"); a legacy Excel
// 97-2003 .xls is an OLE Compound File (D0 CF 11 E0 A1 B1 1A E1). Sniffing content
// instead of trusting the extension matches what the old reader did and means a
// mislabeled file still parses (or fails) for the right reason.
const ZIP_MAGIC = [0x50, 0x4b]
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b)
}

// Flatten an exceljs cell value to the plain trimmed-later string parseRows expects.
// exceljs keeps structure the old reader collapsed for us: rich text is an array of
// runs, hyperlinks carry their display text, formula cells wrap their computed
// result, and true date cells are real JS Dates (the old reader surfaced those as
// raw Excel serial numbers like "45123", so Dates here are strictly an improvement).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellToString(value: any): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((run: { text?: string }) => run.text ?? '').join('')
    }
    // Formula cell: use the computed result. A formula error result is an
    // { error } object with no usable value.
    if ('formula' in value || 'sharedFormula' in value) return cellToString(value.result)
    if ('error' in value) return ''
    // Hyperlink cell: the display text is what the couple sees in Excel.
    if ('text' in value) return cellToString(value.text)
    return String(value)
  }
  return String(value)
}

// Read the first worksheet of an .xlsx into the same header-keyed string rows the
// old sheet_to_json(defval: '') call produced: row 1 is the header row, every data
// row carries every non-empty header as a key (blank cells as ''), and rows with no
// content at all are dropped.
async function readXlsxRows(data: ArrayBuffer): Promise<Record<string, string>[]> {
  const { Workbook } = await import('exceljs')
  const wb = new Workbook()
  await wb.xlsx.load(data)
  const ws = wb.worksheets[0]
  if (!ws) return []

  const headers: (string | undefined)[] = []
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const h = cellToString(cell.value).trim()
    if (h) headers[col] = h
  })
  if (headers.every(h => !h)) return []

  const rawRows: Record<string, string>[] = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const raw: Record<string, string> = {}
    let hasContent = false
    for (let col = 1; col < headers.length; col++) {
      const header = headers[col]
      if (!header) continue
      const val = cellToString(row.getCell(col).value)
      raw[header] = val
      if (val.trim()) hasContent = true
    }
    if (hasContent) rawRows.push(raw)
  })
  return rawRows
}

// Parse CSV text with papaparse (already the CSV writer for the guest-list export,
// so import and export share one dialect). header: true keys each row by its
// header, matching the shape readXlsxRows produces.
async function readCsvRows(text: string): Promise<Record<string, string>[]> {
  const { default: Papa } = await import('papaparse')
  // Strip the UTF-8 BOM our own export prepends (for Excel) so it never sticks to
  // the first header name.
  const body = text.replace(/^\uFEFF/, '')
  const result = Papa.parse<Record<string, string>>(body, {
    header: true,
    skipEmptyLines: 'greedy',
  })
  return result.data
}

export async function parseFile(file: File): Promise<ParsedRow[]> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new ImportFileError(
      'That file is too large to import (over 10 MB). Save your guest list as a plain .xlsx or .csv and try again.'
    )
  }
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (startsWith(bytes, OLE_MAGIC)) {
    throw new ImportFileError(
      'Legacy Excel .xls files are not supported. Open the file in Excel or Google Sheets, save it as .xlsx or .csv, and try again.'
    )
  }

  const rawRows = startsWith(bytes, ZIP_MAGIC)
    ? await readXlsxRows(buffer)
    : await readCsvRows(new TextDecoder('utf-8').decode(buffer))
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
    plusOneName: row.plusOneName || undefined,
    rsvpStatus: row.rsvpStatus,
    tableNumber: row.tableNumber,
  }
}
