import { describe, it, expect } from 'vitest'
import { Workbook } from 'exceljs'
import { parseFile, ImportFileError, MAX_IMPORT_FILE_BYTES } from './guestImport'

// File-level parsing contract for issue #99: the SheetJS `xlsx` package (unfixed
// HIGH advisories, parses user-supplied files) was replaced with exceljs for .xlsx
// and papaparse for .csv. These tests drive parseFile end to end with real file
// bytes: a generated .xlsx workbook, CSV text (including our own export's BOM and
// quoting), and the two rejection paths (legacy .xls, oversized file).

// The template headers the app itself emits (GUEST_SHEET_COLUMNS in GuestListPage),
// so this asserts the exported-sheet round trip survives the reader swap.
const TEMPLATE_HEADERS = [
  'Guest Name(s)',
  'Party',
  'Side (Bride or Groom)',
  'Phone Number',
  'Email Address',
  'Street Address',
  'City',
  'State',
  'Zip Code',
  'Country',
  'Allowed Plus One?',
  'Plus One Name',
  'RSVP Status',
  'Table #',
  'Dietary Restriction',
  'Notes',
]

async function xlsxFile(rows: unknown[][], headers: string[] = TEMPLATE_HEADERS): Promise<File> {
  const wb = new Workbook()
  const ws = wb.addWorksheet('Guests')
  ws.addRow(headers)
  for (const row of rows) ws.addRow(row)
  const buffer = await wb.xlsx.writeBuffer()
  return new File([buffer], 'guests.xlsx')
}

describe('parseFile with .xlsx (exceljs)', () => {
  it('round-trips a template-shaped workbook into ParsedRows', async () => {
    const file = await xlsxFile([
      ['Ruth Boaz', 'Boaz Family', 'Bride', '555-0101', 'ruth@example.com',
       '12 Harvest Ln', 'Bethlehem', 'PA', '18015', 'USA', 'Yes', 'Naomi', 'ATTENDING', 4, 'Vegetarian', 'Loves hymns'],
      ['Silas Cole', '', 'G', '', '', '', '', '', '', '', 'no', '', '', '', '', ''],
    ])
    const rows = await parseFile(file)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      name: 'Ruth Boaz',
      partyName: 'Boaz Family',
      side: 'BRIDE',
      phone: '555-0101',
      email: 'ruth@example.com',
      mailLine1: '12 Harvest Ln',
      mailCity: 'Bethlehem',
      mailState: 'PA',
      mailZip: '18015',
      mailCountry: 'USA',
      plusOneAllowed: true,
      plusOneName: 'Naomi',
      rsvpStatus: 'ATTENDING',
      tableNumber: 4,
      dietaryRestrictions: 'Vegetarian',
      notes: 'Loves hymns',
    })
    expect(rows[1].name).toBe('Silas Cole')
    expect(rows[1].plusOneAllowed).toBe(false)
    expect(rows[1].side).toBe('GROOM')
  })

  it('drops rows without a name and skips fully blank rows', async () => {
    const file = await xlsxFile([
      ['Ann Lee', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'note but no name'],
      [],
      ['Ben Ott', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ])
    const rows = await parseFile(file)
    expect(rows.map(r => r.name)).toEqual(['Ann Lee', 'Ben Ott'])
  })

  it('flattens rich text, hyperlink, and formula cells to their display strings', async () => {
    const wb = new Workbook()
    const ws = wb.addWorksheet('Sheet1')
    ws.addRow(['Name', 'Email', 'Notes'])
    ws.getCell('A2').value = {
      richText: [{ text: 'Mary ' }, { text: 'Magdalene', font: { bold: true } }],
    }
    ws.getCell('B2').value = { text: 'mary@example.com', hyperlink: 'mailto:mary@example.com' }
    ws.getCell('C2').value = { formula: 'CONCATENATE("front"," row")', result: 'front row' }
    const file = new File([await wb.xlsx.writeBuffer()], 'guests.xlsx')

    const rows = await parseFile(file)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Mary Magdalene')
    expect(rows[0].email).toBe('mary@example.com')
    expect(rows[0].notes).toBe('front row')
  })

  it('reads a typed date cell as a readable yyyy-mm-dd string, not an Excel serial', async () => {
    const wb = new Workbook()
    const ws = wb.addWorksheet('Sheet1')
    ws.addRow(['Name', 'Notes'])
    ws.getCell('A2').value = 'Eve Adams'
    ws.getCell('B2').value = new Date(Date.UTC(2026, 5, 20))
    const file = new File([await wb.xlsx.writeBuffer()], 'guests.xlsx')

    const rows = await parseFile(file)
    expect(rows[0].notes).toBe('2026-06-20')
  })

  it('returns no rows for a workbook whose only sheet is empty', async () => {
    const wb = new Workbook()
    wb.addWorksheet('Empty')
    const file = new File([await wb.xlsx.writeBuffer()], 'guests.xlsx')
    expect(await parseFile(file)).toEqual([])
  })
})

describe('parseFile with .csv (papaparse)', () => {
  it('parses CSV shaped like our own export: BOM, quoted commas, embedded newline', async () => {
    const csv =
      '﻿Guest Name(s),Email Address,Street Address,Notes\r\n' +
      '"Cole, Anna",anna@example.com,"1 Vine St, Apt 2","Line one\nline two"\r\n' +
      'Joel Ray,,,\r\n'
    const rows = await parseFile(new File([csv], 'guests.csv'))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      name: 'Cole, Anna',
      email: 'anna@example.com',
      mailLine1: '1 Vine St, Apt 2',
      notes: 'Line one\nline two',
    })
    expect(rows[1].name).toBe('Joel Ray')
    expect(rows[1].email).toBeUndefined()
  })

  it('is detected by content, not extension: CSV bytes in a .xlsx-named file still parse', async () => {
    const rows = await parseFile(new File(['Name\nZoe Hill\n'], 'mislabeled.xlsx'))
    expect(rows.map(r => r.name)).toEqual(['Zoe Hill'])
  })

  it('returns no rows (rather than throwing) for text with no Name column', async () => {
    const rows = await parseFile(new File(['just some prose, nothing tabular'], 'notes.csv'))
    expect(rows).toEqual([])
  })
})

describe('parseFile rejections', () => {
  it('rejects a legacy .xls (OLE signature) with a save-as-.xlsx message', async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0])
    const err = await parseFile(new File([ole], 'guests.xls')).catch(e => e)
    expect(err).toBeInstanceOf(ImportFileError)
    expect(err.message).toContain('.xls files are not supported')
    expect(err.message).toContain('save it as .xlsx or .csv')
  })

  it('rejects a file over the size cap before parsing', async () => {
    const big = new File([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)], 'huge.xlsx')
    const err = await parseFile(big).catch(e => e)
    expect(err).toBeInstanceOf(ImportFileError)
    expect(err.message).toContain('too large')
  })

  it('rejects a corrupt zip (PK signature but not a workbook) with a plain Error the modal maps to generic copy', async () => {
    const fakeZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4])
    await expect(parseFile(new File([fakeZip], 'broken.xlsx'))).rejects.toThrow()
  })
})
