import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, ArrowLeft, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import QueryErrorState from '@/components/QueryErrorState'
import { useGuests } from '@/features/couple/guests/useGuests'
import { useSeatingTables } from './useSeatingTables'
import { countUnseatedAttending } from './seatingGroups'
import { buildPlaceCards, sortPlaceCards, type PlaceCardOrder } from './placeCards'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'

// ─────────────────────────────────────────────────────────────────────────────
// Printable escort / place cards
//
// One card per attending, seated person: their name large, their table under it.
// Laid out as a cut-apart grid of 3.5in x 2in cards, 2 across and 5 down, which
// fits a letter page at a 0.5in margin (7in x 10in of usable area) and matches the
// most common pre-scored place-card stock. Dashed rules are the cut guides.
//
// Same print pipeline as SeatingBoardPage and CeremonyProgramPage: the toolbar is
// print:hidden, an @media print block strips the page chrome, and the couple hits
// Print and either sends it to a printer or saves a PDF for a print shop.
// All the data derivation lives in placeCards.ts so it is unit-tested separately.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ACCENT = '#d4af6a'

const ORDER_OPTIONS: { value: PlaceCardOrder; label: string; hint: string }[] = [
  { value: 'name', label: 'By name', hint: 'Alphabetical, for an escort card table at the entrance' },
  { value: 'table', label: 'By table', hint: 'Grouped by table, for setting a card at each place' },
]

export default function PlaceCardsPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: guests = [], isLoading: guestsLoading, isError: guestsError, refetch: refetchGuests } = useGuests(coupleId)
  const { data: tables = [], isLoading: tablesLoading, isError: tablesError, refetch: refetchTables } = useSeatingTables(coupleId)
  const { data: website } = useWeddingWebsite(coupleId)

  const [order, setOrder] = useState<PlaceCardOrder>('name')

  const isLoading = guestsLoading || tablesLoading
  const isError = guestsError || tablesError
  const refetch = () => { refetchGuests(); refetchTables() }

  const accentColor = website?.accentColor ?? DEFAULT_ACCENT
  const cards = sortPlaceCards(buildPlaceCards(guests, tables), order)
  const hasContent = cards.length > 0
  const unseatedAttending = countUnseatedAttending(guests, tables.length)

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
          <QueryErrorState what="your place cards" onRetry={refetch} />
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" role="group" aria-label="Card order">
              {ORDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setOrder(opt.value)}
                  aria-pressed={order === opt.value}
                  title={opt.hint}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    order === opt.value
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
        <div className="max-w-4xl mx-auto px-4 pb-3 space-y-2">
          {hasContent && (
            <p className="text-xs text-stone-500">
              {cards.length} {cards.length === 1 ? 'card' : 'cards'}, 3.5in x 2in, 10 per letter page.
              Print on card stock and cut along the dashed lines.
            </p>
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
                They will not get a card until you{' '}
                <Link to="/dashboard/seating" className="underline hover:text-amber-900">assign them a table</Link>.
              </span>
            </div>
          )}
        </div>
      </div>

      {!hasContent ? (
        <div className="max-w-xl mx-auto text-center py-24 px-6">
          <p className="text-stone-600 font-medium mb-1">No cards to print yet</p>
          <p className="text-sm text-stone-500">
            Assign guests to tables on the{' '}
            <Link to="/dashboard/seating" className="text-amber-700 underline">seating chart</Link>{' '}
            and each one gets an escort card here, ready to print and cut.
          </p>
        </div>
      ) : (
        <div className="mx-auto my-6 print:my-0 bg-white shadow-lg print:shadow-none w-[7.5in] max-w-full overflow-x-auto print:overflow-visible px-[0.25in] py-[0.25in] print:p-0 cards-sheet">
          {/* Fixed 3.5in columns (not fr units) so a card is exactly card-stock sized
              on paper no matter how wide the screen is. */}
          <div className="grid grid-cols-[3.5in_3.5in] justify-center">
            {cards.map(card => (
              <div
                key={card.key}
                className="place-card w-[3.5in] h-[2in] overflow-hidden flex flex-col items-center justify-center text-center px-4 border border-dashed border-stone-300 print:border-stone-200"
              >
                <p className="font-serif text-xl leading-tight text-stone-900 break-words">{card.name}</p>
                <span
                  className="my-2 block h-px w-10"
                  style={{ backgroundColor: accentColor }}
                  aria-hidden="true"
                />
                <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 break-words">
                  {card.tableLabel}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print styles: letter portrait, strip chrome, never split a card across pages. */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          body { background: white !important; }
          .cards-sheet {
            width: 100% !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          .place-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}
