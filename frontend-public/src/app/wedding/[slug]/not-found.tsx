import Link from 'next/link'

// Rendered when /wedding/[slug] calls notFound() — either the slug does not
// exist OR the couple has not published yet. We don't distinguish the two
// to avoid leaking which slugs are taken; the helpful nudge below covers
// the most common case (couple opens their own URL before clicking
// "Publish" in the dashboard).
export default function WeddingNotFound() {
  return (
    <main className="min-h-screen bg-[#fdfaf6] flex flex-col items-center justify-center px-6 text-center text-[#3b2f2f]">
      <p className="text-xs uppercase tracking-[0.3em] text-[#a08060] mb-4">AltarWed</p>
      <h1 className="font-serif text-3xl sm:text-4xl font-bold mb-3">
        This wedding site is not available yet
      </h1>
      <p className="text-[#6b5b4a] max-w-xl mb-8">
        Either the link is mistyped, or the couple has not published their site.
      </p>

      <div className="rounded-2xl border border-[#e8dcc8] bg-white px-6 py-5 max-w-md text-left">
        <p className="text-sm font-semibold text-[#3b2f2f] mb-1">If this is your site:</p>
        <p className="text-sm text-[#6b5b4a] mb-4">
          Sign in to your dashboard, open the wedding website editor, and click
          <span className="font-medium text-[#3b2f2f]"> Publish</span>. Your guests can only see
          it once you do.
        </p>
        <Link
          href="https://app.altarwed.com/dashboard/website"
          className="inline-block rounded-lg bg-[#d4af6a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b8954f] transition"
        >
          Open the dashboard
        </Link>
      </div>

      <Link href="/" className="mt-10 text-sm text-[#a08060] hover:text-[#3b2f2f] transition">
        ← Back to AltarWed
      </Link>
    </main>
  )
}
