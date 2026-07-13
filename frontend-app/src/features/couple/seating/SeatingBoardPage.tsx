import { Link } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import QueryErrorState from '@/components/QueryErrorState'
import { useGuests, type Guest } from '@/features/couple/guests/useGuests'
import { useSeatingTables } from './useSeatingTables'
import TableShapeIcon from './TableShapeIcon'

// ─────────────────────────────────────────────────────────────────────────────
// Printable seating board
//
// The artifact couples actually display at the reception: a large "Find Your
// Seat" board (commonly 24x36in) listing every guest alphabetically by last
// name with their table number, so arriving guests can locate themselves at a
// glance. We render two views:
//   1. "Find your seat", alphabetical by last name to table (the printed board)
//   2. "By table", each table with its seated guests (the couple's own check)
//
// Same print pipeline as the ceremony program: @media print strips the chrome,
// the couple clicks Print and uses "Save as PDF" or sends to a sign printer.
// Sort and grouping happen here, not in the seating editor, so the editor stays
// free-form drag-and-drop and this view is always the clean finalized cut.
// ─────────────────────────────────────────────────────────────────────────────

// Last name = last whitespace-separated token, used as the alphabetical key.
// Falls back to the full name for single-word entries.
function lastNameKey(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[parts.length - 1] || name).toLowerCase()
}

interface BoardRow {
  display: string
  sortKey: string
  tableLabel: string
}

export default function SeatingBoardPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: guests = [], isLoading: guestsLoading, isError: guestsError, refetch: refetchGuests } = useGuests(coupleId)
  const { data: tables = [], isLoading: tablesLoading, isError: tablesError, refetch: refetchTables } = useSeatingTables(coupleId)
  const isLoading = guestsLoading || tablesLoading
  const isError = guestsError || tablesError
  const refetch = () => { refetchGuests(); refetchTables() }

  const tableNameFor = (g: Guest): string | null => {
    if (!g.tableNumber) return null
    const t = tables[g.tableNumber - 1]
    return t ? t.name : null
  }

  // Build the alphabetical "find your seat" rows. Each guest and any named
  // plus-one becomes its own row so a guest searching for either name finds it.
  const rows: BoardRow[] = []
  for (const g of guests) {
    const tableLabel = tableNameFor(g)
    if (!tableLabel) continue // only assigned guests belong on the board
    rows.push({ display: g.name, sortKey: lastNameKey(g.name), tableLabel })
    if (g.plusOneName) {
      rows.push({ display: g.plusOneName, sortKey: lastNameKey(g.plusOneName), tableLabel })
    }
  }
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.display.localeCompare(b.display))

  const assignedGuestsByTable = (idx: number): Guest[] =>
    guests.filter(g => g.tableNumber === idx + 1).sort((a, b) => lastNameKey(a.name).localeCompare(lastNameKey(b.name)))

  const hasContent = rows.length > 0

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-stone-100">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <QueryErrorState what="your seating chart" onRetry={refetch} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-100 print:bg-white">
      {/* Screen-only toolbar */}
      <div className="bg-white border-b border-stone-200 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to="/dashboard/seating"
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 transition"
          >
            <ArrowLeft size={16} /> Back to seating chart
          </Link>
          <button
            onClick={() => window.print()}
            disabled={!hasContent}
            className="inline-flex items-center gap-2 rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white hover:bg-brown/90 disabled:opacity-60 transition"
          >
            <Printer size={16} />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {!hasContent ? (
        <div className="max-w-xl mx-auto text-center py-24 px-6">
          <p className="text-stone-600 font-medium mb-1">No seated guests yet</p>
          <p className="text-sm text-stone-500">
            Assign guests to tables on the{' '}
            <Link to="/dashboard/seating" className="text-amber-700 underline">seating chart</Link>{' '}
            and they will appear here, ready to print.
          </p>
        </div>
      ) : (
        <article className="mx-auto my-6 print:my-0 bg-white text-stone-900 shadow-lg print:shadow-none w-[8.5in] max-w-full min-h-[11in] px-12 py-14 print:px-10 print:py-12 board-page">

          {/* Find your seat, alphabetical */}
          <header className="text-center border-b-2 border-double border-stone-400 pb-6 mb-8">
            <p className="text-xs uppercase tracking-[0.4em] text-stone-500 mb-3">Please Find Your Seat</p>
            <h1 className="font-serif text-4xl font-bold text-stone-900">Welcome</h1>
          </header>

          <section className="mb-12">
            <ul className="columns-2 gap-10 [column-rule:1px_solid_#e7e5e4]">
              {rows.map((r, i) => (
                <li key={`${r.display}-${i}`} className="flex items-baseline justify-between gap-3 break-inside-avoid py-1.5">
                  <span className="font-serif text-stone-800">{r.display}</span>
                  <span className="flex-1 border-b border-dotted border-stone-300 mx-1 translate-y-[-3px]" />
                  <span className="font-serif font-semibold text-stone-900 whitespace-nowrap">{r.tableLabel}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* By table, the couple's own cross-check */}
          <section className="break-before-page">
            <h2 className="text-center text-xs uppercase tracking-[0.3em] text-stone-500 mb-6 pb-2 border-b border-stone-300">
              Tables at a Glance
            </h2>
            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              {tables.map((t, idx) => {
                const seated = assignedGuestsByTable(idx)
                if (seated.length === 0) return null
                return (
                  <div key={t.id} className="break-inside-avoid">
                    <p className="font-serif font-semibold text-stone-800 mb-1.5 pb-1 border-b border-stone-200 flex items-center gap-1.5">
                      <TableShapeIcon shape={t.shape} capacity={t.capacity} size={18} className="text-stone-500 flex-shrink-0" />
                      <span>{t.name}</span>{' '}
                      <span className="text-xs font-normal text-stone-400">({seated.length}/{t.capacity})</span>
                    </p>
                    <ul className="space-y-0.5">
                      {seated.map(g => (
                        <li key={g.id} className="text-sm text-stone-700">
                          {g.name}{g.plusOneName ? <span className="text-stone-400"> &amp; {g.plusOneName}</span> : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>

          <footer className="text-center mt-12 pt-6 border-t-2 border-double border-stone-400">
            <p className="text-[10px] text-stone-400 uppercase tracking-widest">Created with AltarWed</p>
          </footer>
        </article>
      )}

      {/* Print styles: letter portrait, strip chrome and margins. */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          body { background: white !important; }
          .board-page {
            width: 100% !important;
            min-height: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
