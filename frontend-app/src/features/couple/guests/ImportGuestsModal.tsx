import { useState, useRef, useMemo } from 'react'
import { X, Upload } from 'lucide-react'
import { useModalA11y } from '@/lib/useModalA11y'
import {
  parseFile,
  toCreatePayload,
  findDuplicates,
  MAX_IMPORT_ROWS,
  type ParsedRow,
  type ExistingGuestKey,
} from './guestImport'
import type { CreateGuestPayload } from './useGuests'

interface Props {
  coupleId: string
  // The already-loaded guest list (GuestListPage keeps it in the useGuests cache),
  // passed in so the duplicate matcher works off it without a second fetch.
  existingGuests: ExistingGuestKey[]
  onImport: (guests: CreateGuestPayload[]) => Promise<void>
  onClose: () => void
  isPending: boolean
}

export default function ImportGuestsModal({ existingGuests, onImport, onClose, isPending }: Props) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [parsing, setParsing] = useState(false)
  // Skip likely duplicates by default; a couple who re-imports a tweaked sheet
  // almost never wants the whole list added again. They can opt back in.
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  // Focus in on open, Escape closes, focus restored on close (WCAG 2.4.3 / 2.1.2),
  // matching AddGuestModal and the budget modal.
  const dialogRef = useModalA11y<HTMLDivElement>(true, onClose)

  // Duplicate report, recomputed only when the parsed rows or existing list change.
  const dupReport = useMemo(
    () => (rows ? findDuplicates(rows, existingGuests) : null),
    [rows, existingGuests]
  )
  // A file over the per-import cap is stopped here, before any network call, with a
  // specific message instead of a generic backend rejection.
  const overLimit = rows != null && rows.length > MAX_IMPORT_ROWS
  const dupCount = dupReport ? dupReport.existingCount + dupReport.inFileCount : 0
  const uniqueCount = dupReport
    ? dupReport.reasons.filter(r => r === null).length
    : rows?.length ?? 0
  // How many rows the Import button will actually send given the current toggle.
  const importCount = skipDuplicates ? uniqueCount : rows?.length ?? 0

  const handleFile = async (file: File) => {
    setParseError('')
    setParsing(true)
    try {
      const parsed = await parseFile(file)
      setRows(parsed)
      setFileName(file.name)
      if (parsed.length === 0) {
        setParseError('No importable rows found. Make sure your file has a "Name" column with guest names.')
      }
    } catch {
      setParseError('Could not read the file. Make sure it is a valid .xlsx, .xls, or .csv file.')
      setRows(null)
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (!rows || rows.length === 0 || overLimit) return
    // When skipping, send only the rows that look new (null reason); otherwise send
    // everything. dupReport is index-aligned with rows.
    const toImport =
      skipDuplicates && dupReport ? rows.filter((_, i) => dupReport.reasons[i] === null) : rows
    if (toImport.length === 0) return
    await onImport(toImport.map(toCreatePayload))
  }

  const preview = rows?.slice(0, 10) ?? []

  // Compact address for the preview so a couple can confirm mailing details survived
  // the import before committing (postcards filter on mailLine1, so this is the
  // load-bearing outcome of the column-parity fix). Falls back to city/state when
  // only a partial address was provided.
  const previewAddress = (row: ParsedRow): string => {
    const cityState = [row.mailCity, row.mailState].filter(Boolean).join(', ')
    return row.mailLine1 || cityState || '-'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gold-light shrink-0">
          <h2 id="import-dialog-title" className="font-serif text-lg font-semibold text-brown">
            Import guests from spreadsheet
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-brown-light hover:text-brown focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Drop zone: the wrapper carries the drag handlers; the click/keyboard
              affordance is a real <button> so it is operable and announced natively. */}
          <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-gold/50 bg-ivory/60 hover:border-gold hover:bg-gold/5 transition cursor-pointer p-8 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Upload size={28} className="mx-auto mb-2 text-gold" />
              <span className="block text-sm font-medium text-brown">
                {fileName ? fileName : 'Drop a file here, or click to choose'}
              </span>
              <span className="block text-xs text-brown-light mt-1">Accepts .xlsx, .xls, and .csv</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              aria-label="Choose spreadsheet file"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          {/* Column hint */}
          {!rows && !parseError && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              <span className="font-semibold">Works with the guest list template.</span>{' '}
              Most columns from the "Copy headers" template import, including party, mailing
              address, plus-one allowed, side, dietary, and the basics. Headers are matched
              case-insensitively and only Name is required. A few columns you manage inside
              AltarWed are skipped: Plus One Name, RSVP Status, and Table #.
            </div>
          )}

          {parsing && (
            <p className="text-sm text-center text-brown-light animate-pulse">Reading file...</p>
          )}

          {parseError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {parseError}
            </div>
          )}

          {/* Over the per-import cap: stop here with a specific, actionable message. */}
          {overLimit && rows && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              That file has {rows.length} guests; the limit is {MAX_IMPORT_ROWS} per import. Split it
              and import twice.
            </div>
          )}

          {/* Duplicate summary + skip toggle. Only shown when we actually found some. */}
          {!overLimit && rows && rows.length > 0 && dupReport && dupCount > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 space-y-2">
              <div className="space-y-0.5">
                {dupReport.existingCount > 0 && (
                  <p>
                    <span className="font-semibold">{dupReport.existingCount}</span>{' '}
                    {dupReport.existingCount === 1 ? 'guest looks' : 'guests look'} like{' '}
                    {dupReport.existingCount === 1 ? 'someone' : 'people'} you already have.
                  </p>
                )}
                {dupReport.inFileCount > 0 && (
                  <p>
                    <span className="font-semibold">{dupReport.inFileCount}</span>{' '}
                    {dupReport.inFileCount === 1 ? 'row is' : 'rows are'} repeated inside this file.
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={e => setSkipDuplicates(e.target.checked)}
                  className="rounded border-amber-400 text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                />
                <span className="font-medium">Skip duplicates (recommended)</span>
              </label>
              <p className="text-xs text-amber-800">
                {skipDuplicates
                  ? `We'll import the ${uniqueCount} that look new and leave the rest alone.`
                  : "We'll import everyone, including the duplicates."}
              </p>
            </div>
          )}

          {/* Preview table */}
          {!overLimit && rows && rows.length > 0 && (
            <div>
              <p className="text-xs font-medium text-brown-light mb-2">
                {rows.length <= 10
                  ? `Previewing all ${rows.length} guest${rows.length === 1 ? '' : 's'}`
                  : `Previewing 10 of ${rows.length} guests`}
              </p>
              <div className="overflow-x-auto rounded-xl border border-gold-light">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-ivory/60 border-b border-gold-light">
                      <th className="px-3 py-2 text-left text-brown-light font-semibold">Name</th>
                      <th className="px-3 py-2 text-left text-brown-light font-semibold hidden sm:table-cell">Email</th>
                      <th className="px-3 py-2 text-left text-brown-light font-semibold">Side</th>
                      <th className="px-3 py-2 text-left text-brown-light font-semibold">Address</th>
                      <th className="px-3 py-2 text-left text-brown-light font-semibold hidden md:table-cell">Dietary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const reason = dupReport?.reasons[i] ?? null
                      // A skipped duplicate is dimmed; the badge says which kind it is.
                      const dimmed = reason !== null && skipDuplicates
                      return (
                        <tr
                          key={i}
                          className={`border-b border-gold-light/50 last:border-0 ${reason !== null ? 'bg-amber-50/60' : ''}`}
                        >
                          <td className={`px-3 py-2 font-medium ${dimmed ? 'text-brown-light line-through' : 'text-brown'}`}>
                            <span>{row.name}</span>
                            {reason !== null && (
                              <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 no-underline align-middle">
                                {reason === 'existing' ? 'Already added' : 'Repeat in file'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-brown-light hidden sm:table-cell">{row.email ?? '-'}</td>
                          <td className="px-3 py-2 text-brown-light capitalize">{row.side?.toLowerCase() ?? '-'}</td>
                          <td className="px-3 py-2 text-brown-light max-w-[12rem] truncate" title={previewAddress(row)}>{previewAddress(row)}</td>
                          <td className="px-3 py-2 text-brown-light hidden md:table-cell">{row.dietaryRestrictions ?? '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && (
                <p className="text-xs text-brown-light mt-1.5 text-right">
                  + {rows.length - 10} more not shown
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gold-light shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gold-light px-5 py-2 text-sm font-medium text-brown hover:bg-ivory transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!rows || rows.length === 0 || overLimit || importCount === 0 || isPending}
            className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-brown hover:bg-gold-dark disabled:opacity-50 transition"
          >
            {isPending
              ? 'Importing...'
              : !rows || overLimit
                ? 'Import'
                : importCount === 0
                  ? 'Nothing new to import'
                  : `Import ${importCount} guest${importCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
