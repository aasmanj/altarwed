import { Link } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import { useCeremonySections } from './useCeremonySections'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { useWeddingParty } from '@/features/couple/weddingparty/useWeddingParty'
import { formatWeddingDate } from '@/lib/date'

// ─────────────────────────────────────────────────────────────────────────────
// Printable ceremony program
//
// Pulls from three sources to produce a single page guests can hold during the
// service: ceremony order of service, wedding party (with NEUTRAL members
// covering officiant, musicians, readers), and the wedding website (couple
// names, date, venue). Designed for portrait letter/A4 with @media print styles
// that strip browser chrome, couples click "Print" and use the browser's
// "Save as PDF" or send straight to a printer.
// ─────────────────────────────────────────────────────────────────────────────

export default function CeremonyProgramPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: website } = useWeddingWebsite(coupleId)
  const { data: sections = [] } = useCeremonySections(coupleId)
  const { data: members = [] } = useWeddingParty(website?.id ?? '')

  const brideParty   = members.filter(m => m.side === 'BRIDE')
  const groomParty   = members.filter(m => m.side === 'GROOM')
  const ceremonyTeam = members.filter(m => m.side === 'NEUTRAL')

  const coupleLine = website
    ? `${website.partnerTwoName} & ${website.partnerOneName}`
    : 'The Couple'
  const dateLine = website?.weddingDate ? formatWeddingDate(website.weddingDate) : ''
  const venueLine = website?.venueName ?? ''
  const venueCityLine = [website?.venueCity, website?.venueState].filter(Boolean).join(', ')

  const hasContent = sections.length > 0 || members.length > 0 || website

  return (
    <div className="min-h-screen bg-stone-100 print:bg-white">
      {/* Screen-only toolbar */}
      <div className="bg-white border-b border-stone-200 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to="/dashboard/ceremony"
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 transition"
          >
            <ArrowLeft size={16} /> Back to ceremony builder
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

      {/* Program, letter-sized canvas */}
      <article className="mx-auto my-6 print:my-0 bg-white text-stone-900 shadow-lg print:shadow-none w-[8.5in] max-w-full min-h-[11in] px-12 py-14 print:px-10 print:py-12 program-page">

        {/* Cover header */}
        <header className="text-center border-b-2 border-double border-stone-400 pb-6 mb-8">
          <p className="text-xs uppercase tracking-[0.4em] text-stone-500 mb-3">The Wedding Of</p>
          <h1 className="font-serif text-4xl font-bold text-stone-900 leading-tight">{coupleLine}</h1>
          {dateLine && (
            <p className="font-serif text-base text-stone-600 italic mt-3">{dateLine}</p>
          )}
          {(venueLine || venueCityLine) && (
            <p className="text-sm text-stone-500 mt-1">
              {venueLine}{venueLine && venueCityLine ? ' · ' : ''}{venueCityLine}
            </p>
          )}
          {website?.ceremonyTime && (
            <p className="text-sm text-stone-500 mt-1">{website.ceremonyTime}</p>
          )}
        </header>

        {/* Scripture banner */}
        {(website?.scriptureText || website?.scriptureReference) && (
          <section className="text-center mb-8 px-6">
            {website.scriptureText && (
              <p className="font-serif italic text-stone-700 text-base leading-relaxed">
                "{website.scriptureText}"
              </p>
            )}
            {website.scriptureReference && (
              <p className="text-xs uppercase tracking-widest text-stone-500 mt-2">
                {website.scriptureReference}
              </p>
            )}
          </section>
        )}

        {/* Order of Service */}
        {sections.length > 0 && (
          <section className="mb-10">
            <h2 className="text-center text-xs uppercase tracking-[0.3em] text-stone-500 mb-4 pb-2 border-b border-stone-300">
              Order of Service
            </h2>
            <ol className="space-y-3">
              {sections.map((s, i) => (
                <li key={s.id} className="flex items-baseline gap-3 break-inside-avoid">
                  <span className="font-serif text-stone-400 text-sm w-6 text-right flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 border-b border-dotted border-stone-300 pb-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-serif font-semibold text-stone-800 text-sm">{s.title}</p>
                      {s.content && (
                        <p className="text-xs text-stone-500 italic text-right truncate max-w-[55%]">{s.content}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Ceremony team (officiant, musicians, readers) */}
        {ceremonyTeam.length > 0 && (
          <section className="mb-10 break-inside-avoid">
            <h2 className="text-center text-xs uppercase tracking-[0.3em] text-stone-500 mb-4 pb-2 border-b border-stone-300">
              Officiant, Musicians & Readers
            </h2>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-2">
              {ceremonyTeam.map(m => (
                <li key={m.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-stone-500 italic">{m.role}</span>
                  <span className="font-serif font-medium text-stone-800 text-right">{m.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Wedding Party, two columns */}
        {(brideParty.length > 0 || groomParty.length > 0) && (
          <section className="mb-10 break-inside-avoid">
            <h2 className="text-center text-xs uppercase tracking-[0.3em] text-stone-500 mb-4 pb-2 border-b border-stone-300">
              Wedding Party
            </h2>
            <div className="grid grid-cols-2 gap-x-10">
              <div>
                <p className="font-serif text-center text-sm font-semibold text-stone-700 mb-3 uppercase tracking-wide">
                  {website?.partnerTwoName ? `${website.partnerTwoName}'s Side` : "Bride's Side"}
                </p>
                <ul className="space-y-1.5">
                  {brideParty.map(m => (
                    <li key={m.id} className="text-center text-sm">
                      <p className="font-serif font-medium text-stone-800">{m.name}</p>
                      <p className="text-xs text-stone-500 italic">{m.role}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-serif text-center text-sm font-semibold text-stone-700 mb-3 uppercase tracking-wide">
                  {website?.partnerOneName ? `${website.partnerOneName}'s Side` : "Groom's Side"}
                </p>
                <ul className="space-y-1.5">
                  {groomParty.map(m => (
                    <li key={m.id} className="text-center text-sm">
                      <p className="font-serif font-medium text-stone-800">{m.name}</p>
                      <p className="text-xs text-stone-500 italic">{m.role}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Closing */}
        <footer className="text-center mt-12 pt-6 border-t-2 border-double border-stone-400">
          <p className="font-serif italic text-stone-600 text-sm">
            {website
              ? `Thank you for celebrating the marriage of ${coupleLine}.`
              : 'Thank you for celebrating with us today.'}
          </p>
          <p className="text-[10px] text-stone-400 mt-3 uppercase tracking-widest">
            Created with AltarWed
          </p>
        </footer>

        {!hasContent && (
          <div className="text-center py-16">
            <p className="text-stone-500 text-sm">
              Add ceremony sections, wedding party members, and basic wedding info to build your program.
            </p>
          </div>
        )}
      </article>

      {/* Print-specific styles: hide everything but the program, kill margins */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          body { background: white !important; }
          .program-page {
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
