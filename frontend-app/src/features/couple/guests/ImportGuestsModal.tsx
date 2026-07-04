import { useState, useRef } from 'react'
import { X, Upload } from 'lucide-react'
import { useModalA11y } from '@/lib/useModalA11y'
import { parseFile, toCreatePayload, type ParsedRow } from './guestImport'
import type { CreateGuestPayload } from './useGuests'

interface Props {
  coupleId: string
  onImport: (guests: CreateGuestPayload[]) => Promise<void>
  onClose: () => void
  isPending: boolean
}

export default function ImportGuestsModal({ onImport, onClose, isPending }: Props) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [parsing, setParsing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Focus in on open, Escape closes, focus restored on close (WCAG 2.4.3 / 2.1.2),
  // matching AddGuestModal and the budget modal.
  const dialogRef = useModalA11y<HTMLDivElement>(true, onClose)

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
    if (!rows || rows.length === 0) return
    await onImport(rows.map(toCreatePayload))
  }

  const preview = rows?.slice(0, 10) ?? []

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
              Every column from the "Copy headers" template imports, including party, mailing
              address, and plus-one. Headers are matched case-insensitively, only Name is
              required, and extra columns are ignored.
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

          {/* Preview table */}
          {rows && rows.length > 0 && (
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
                      <th className="px-3 py-2 text-left text-brown-light font-semibold hidden md:table-cell">Dietary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-gold-light/50 last:border-0">
                        <td className="px-3 py-2 text-brown font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-brown-light hidden sm:table-cell">{row.email ?? '-'}</td>
                        <td className="px-3 py-2 text-brown-light capitalize">{row.side?.toLowerCase() ?? '-'}</td>
                        <td className="px-3 py-2 text-brown-light hidden md:table-cell">{row.dietaryRestrictions ?? '-'}</td>
                      </tr>
                    ))}
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
            disabled={!rows || rows.length === 0 || isPending}
            className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-brown hover:bg-gold-dark disabled:opacity-50 transition"
          >
            {isPending ? 'Importing...' : rows ? `Import ${rows.length} guest${rows.length === 1 ? '' : 's'}` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
