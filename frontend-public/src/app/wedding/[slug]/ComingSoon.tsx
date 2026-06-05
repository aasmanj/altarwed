import Link from 'next/link'
import { formatWeddingDate, daysUntilDate } from '@/lib/date'
import type { WeddingWebsite } from './data'

// Shown when a slug exists but the couple has not published yet, instead of a
// bare 404. The couple deliberately shared this URL (often before clicking
// Publish, or to eager guests), so a warm "coming soon" beats a dead end.
// Truly-missing or soft-deleted slugs still 404 (see the page/layout gates).
//
// Display convention: bride (partnerTwoName) first, per Jordan's wife-first
// preference. DB convention is unchanged (partnerOneName = Groom).
export default function ComingSoon({ wedding }: { wedding: WeddingWebsite }) {
  const names =
    wedding.partnerTwoName && wedding.partnerOneName
      ? `${wedding.partnerTwoName} & ${wedding.partnerOneName}`
      : null
  const countdown = wedding.weddingDate ? daysUntilDate(wedding.weddingDate) : null

  return (
    <main className="min-h-screen bg-[#fdfaf6] flex flex-col items-center justify-center px-6 py-16 text-center text-[#3b2f2f]">
      <p className="text-xs uppercase tracking-[0.3em] text-[#a08060] mb-5">AltarWed</p>

      {names && (
        <h1 className="font-serif text-4xl sm:text-5xl font-bold mb-3 break-words text-balance max-w-3xl">
          {names}
        </h1>
      )}

      <div className="my-2 flex items-center justify-center gap-4">
        <div className="h-px w-12 bg-[#d4af6a]/50" />
        <span className="text-[#d4af6a] text-sm uppercase tracking-[0.3em]">Coming soon</span>
        <div className="h-px w-12 bg-[#d4af6a]/50" />
      </div>

      <p className="text-[#6b5b4a] max-w-xl mt-4">
        {names ? 'Their' : 'This'} wedding website is being prepared. Check back soon to celebrate
        with them.
      </p>

      {wedding.weddingDate && (
        <div className="mt-8 rounded-2xl bg-[#3b2f2f] text-white px-8 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[#d4af6a]/80 mb-1">Save the date</p>
          <p className="font-serif text-2xl sm:text-3xl font-bold text-[#d4af6a]">
            {formatWeddingDate(wedding.weddingDate)}
          </p>
          {countdown !== null && countdown > 0 && (
            <p className="mt-1 text-white/70 text-sm">{countdown} days to go</p>
          )}
        </div>
      )}

      {/* Nudge for the owner who opened their own URL before publishing. */}
      <div className="mt-10 rounded-2xl border border-[#e8dcc8] bg-white px-6 py-5 max-w-md text-left">
        <p className="text-sm font-semibold text-[#3b2f2f] mb-1">If this is your site:</p>
        <p className="text-sm text-[#6b5b4a] mb-4">
          Sign in, open the wedding website editor, and click
          <span className="font-medium text-[#3b2f2f]"> Publish</span>. Guests can see your site
          the moment you do.
        </p>
        <Link
          href="https://app.altarwed.com/dashboard/website"
          className="inline-block rounded-lg bg-[#d4af6a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b8954f] transition"
        >
          Open the dashboard
        </Link>
      </div>

      {/* Viral footer: every public surface carries the "create your own" CTA. */}
      <div className="mt-12 space-y-3">
        <p className="text-sm text-[#6b5344]">Getting married? Create your Christian wedding website for free.</p>
        <a
          href="https://app.altarwed.com/register?utm_source=wedding-site&utm_medium=referral&utm_campaign=coming-soon"
          className="inline-block px-6 py-2.5 rounded-full bg-[#3b2f2f] text-white text-xs font-semibold hover:bg-[#5c4033] transition"
        >
          Start for free →
        </a>
      </div>

      <Link href="https://www.altarwed.com" className="mt-10 text-sm text-[#a08060] hover:text-[#3b2f2f] transition">
        ← Back to AltarWed
      </Link>
    </main>
  )
}
