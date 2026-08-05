import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import QueryErrorState from '@/components/QueryErrorState'
import { useGuests } from '@/features/couple/guests/useGuests'
import { useSeatingTables } from './useSeatingTables'
import { countUnseatedAttending } from './seatingGroups'
import { buildTableGroups } from './tableBoard'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'

// ─────────────────────────────────────────────────────────────────────────────
// By-table seating printouts
//
// The table-assignment artifacts receptions actually display, in two formats the
// couple picks between:
//   1. "Big board", one 24in x 36in poster listing every table with its guests,
//      displayed at the reception entrance. Printed via Save as PDF and sent to
//      a sign printer (same flow the alphabetical SeatingBoardPage documents).
//   2. "Table cards", one 5x7in or 6x9in card per table, set on the table
//      itself, printed on card stock (one card per page).
//
// Both formats render the same buildTableGroups() derivation, so they can never
// disagree. Same print pipeline as SeatingBoardPage: print:hidden toolbar,
// @media print strips the chrome, and the @page size follows the chosen format.
// The 24x36 board previews on screen at one-third size via `zoom` (layout-
// affecting, unlike transform, so the page reserves the right space) and prints
// at full size.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TITLE = 'Welcome'
const DEFAULT_ACCENT = '#d4af6a'

type PrintFormat = 'board' | 'cards'
type CardSize = '5x7' | '6x9'

const FORMAT_OPTIONS: { value: PrintFormat; label: string; hint: string }[] = [
  { value: 'board', label: 'Big board', hint: 'One 24x36in poster with every table, for the reception entrance' },
  { value: 'cards', label: 'Table cards', hint: 'One card per table, set on the table itself' },
]

const CARD_SIZES: Record<CardSize, { label: string; w: string; h: string }> = {
  '5x7': { label: '5x7 in', w: '5in', h: '7in' },
  '6x9': { label: '6x9 in', w: '6in', h: '9in' },
}

// Name lines that fit a card's list without clipping: card height minus vertical
// padding (1.1in) and the header block (eyebrow + table name + divider, ~1.3in),
// at the list's 0.32in line height. 5x7 leaves ~4.6in (14 lines), 6x9 ~6.6in
// (20 lines). The card clips overflow (a bleed off card stock is worse), so the
// toolbar warns the couple instead of letting names vanish silently.
const MAX_CARD_NAMES: Record<CardSize, number> = { '5x7': 14, '6x9': 20 }

export default function TableBoardPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: guests = [], isLoading: guestsLoading, isError: guestsError, refetch: refetchGuests } = useGuests(coupleId)
  const { data: tables = [], isLoading: tablesLoading, isError: tablesError, refetch: refetchTables } = useSeatingTables(coupleId)
  const { data: website } = useWeddingWebsite(coupleId)

  const [format, setFormat] = useState<PrintFormat>('board')
  const [cardSize, setCardSize] = useState<CardSize>('5x7')

  const isLoading = guestsLoading || tablesLoading
  const isError = guestsError || tablesError
  const refetch = () => { refetchGuests(); refetchTables() }

  const accentColor = website?.accentColor ?? DEFAULT_ACCENT
  const boardTitle = website?.seatingBoardTitle ?? DEFAULT_TITLE

  const groups = buildTableGroups(guests, tables)
  const hasContent = groups.length > 0
  const unseatedAttending = countUnseatedAttending(guests, tables.length)
  const size = CARD_SIZES[cardSize]
  const overflowingTables =
    format === 'cards' ? groups.filter(g => g.names.length > MAX_CARD_NAMES[cardSize]) : []

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
          <QueryErrorState what="your table assignments" onRetry={refetch} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-100 print:bg-white">
      {/* Screen-only toolbar */}
      <div className="bg-white border-b border-stone-200 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard/seating"
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 transition"
          >
            <ArrowLeft size={16} /> Back to seating chart
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1" role="group" aria-label="Print format">
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value)}
                  aria-pressed={format === opt.value}
                  title={opt.hint}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    format === opt.value
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {format === 'cards' && (
              <div className="flex items-center gap-1" role="group" aria-label="Card size">
                {(Object.keys(CARD_SIZES) as CardSize[]).map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCardSize(value)}
                    aria-pressed={cardSize === value}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      cardSize === value
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {CARD_SIZES[value].label}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!hasContent}
              className="inline-flex items-center gap-2 rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white hover:bg-brown/90 disabled:opacity-60 transition"
            >
              <Printer size={16} />
              Print / Save as PDF
            </button>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-3 space-y-2">
          {hasContent && (
            <p className="text-xs text-stone-500">
              {format === 'board'
                ? '24in x 36in poster (shown at one-third size). Save as PDF and send it to a sign or poster printer.'
                : `${groups.length} ${groups.length === 1 ? 'card' : 'cards'}, one per table, ${size.label} each on its own page. Save as PDF and print on card stock.`}
            </p>
          )}
          {overflowingTables.length > 0 && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold">
                  {overflowingTables.map(g => g.tableLabel).join(', ')}{' '}
                  {overflowingTables.length === 1 ? 'has' : 'have'} more guests than fit a {size.label} card.
                </strong>{' '}
                {cardSize === '5x7'
                  ? 'Names past the bottom will be cut off. Switch to 6x9.'
                  : 'Names past the bottom will be cut off. Split the table into two smaller tables to fit.'}
              </span>
            </div>
          )}
          {unseatedAttending > 0 && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold">
                  {unseatedAttending} attending {unseatedAttending === 1 ? 'guest is' : 'guests are'} not seated yet.
                </strong>{' '}
                They will not appear here until you{' '}
                <Link to="/dashboard/seating" className="underline hover:text-amber-900">assign them a table</Link>.
              </span>
            </div>
          )}
        </div>
      </div>

      {!hasContent ? (
        <div className="max-w-xl mx-auto text-center py-24 px-6">
          <p className="text-stone-600 font-medium mb-1">No seated guests yet</p>
          <p className="text-sm text-stone-500">
            Assign guests to tables on the{' '}
            <Link to="/dashboard/seating" className="text-amber-700 underline">seating chart</Link>{' '}
            and every table will appear here, ready to print.
          </p>
        </div>
      ) : format === 'board' ? (
        /* One 24x36 poster: every table with its guests, packed into columns. */
        <div className="overflow-x-auto">
          <article className="board-zoom mx-auto my-6 print:my-0 bg-white text-stone-900 shadow-lg print:shadow-none w-[24in] min-h-[36in] px-[1.5in] py-[1.75in]">
            <header
              className="text-center border-b-4 border-double pb-[0.6in] mb-[0.8in]"
              style={{ borderColor: accentColor }}
            >
              <p className="text-[0.28in] uppercase tracking-[0.4em] text-stone-500 mb-[0.25in]">Please Find Your Table</p>
              <h1 className="font-serif text-[1.1in] leading-none font-bold text-stone-900">{boardTitle}</h1>
            </header>

            <div className="columns-3 gap-[1in]">
              {groups.map(group => (
                <section key={group.key} className="break-inside-avoid mb-[0.7in]">
                  <h2
                    className="font-serif text-[0.42in] leading-tight font-semibold text-stone-900 text-center border-b-2 pb-[0.12in] mb-[0.18in]"
                    style={{ borderColor: accentColor }}
                  >
                    {group.tableLabel}
                  </h2>
                  <ul className="text-center">
                    {group.names.map((name, i) => (
                      <li key={`${group.key}-${i}`} className="font-serif text-[0.28in] leading-[0.44in] text-stone-800">
                        {name}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <footer
              className="text-center mt-[0.8in] pt-[0.4in] border-t-4 border-double"
              style={{ borderColor: accentColor }}
            >
              <p className="text-[0.14in] text-stone-400 uppercase tracking-widest">Created with AltarWed</p>
            </footer>
          </article>
        </div>
      ) : (
        /* One card per table, each exactly one page of the chosen card size. */
        <div className="py-6 print:py-0 flex flex-col items-center gap-6 print:gap-0">
          {/* Cards have no visible page title (each card is its own artifact), so
              give assistive tech a heading to anchor the list. */}
          <h1 className="sr-only">Table cards</h1>
          {groups.map(group => (
            <article
              key={group.key}
              className="table-card bg-white text-stone-900 shadow-lg print:shadow-none flex flex-col items-center px-[0.45in] py-[0.55in] overflow-hidden"
              style={{ width: size.w, height: size.h }}
            >
              <p className="text-[0.13in] uppercase tracking-[0.35em] text-stone-500 mb-[0.18in]">Please Be Seated At</p>
              <h2 className="font-serif text-[0.42in] leading-tight font-bold text-stone-900 text-center break-words max-w-full">
                {group.tableLabel}
              </h2>
              <span
                className="my-[0.22in] block w-[1.2in] border-t-2"
                style={{ borderColor: accentColor }}
                aria-hidden="true"
              />
              <ul className="text-center">
                {group.names.map((name, i) => (
                  <li key={`${group.key}-${i}`} className="font-serif text-[0.2in] leading-[0.32in] text-stone-800 break-words">
                    {name}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {/* Print styles: page size follows the chosen format; strip chrome. The
          board previews at one-third size on screen (zoom affects layout, so no
          reserved-height hacks) and prints at its true 24x36. */}
      <style>{`
        .board-zoom { zoom: 0.3333; }
        @media print {
          @page {
            size: ${format === 'board' ? '24in 36in' : `${size.w} ${size.h}`};
            margin: 0;
          }
          body { background: white !important; }
          .board-zoom { zoom: 1; margin: 0 !important; }
          .table-card {
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* A forced break after the final card would print a trailing blank
             page (an extra sheet of card stock); the last card ends the doc. */
          .table-card:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  )
}
