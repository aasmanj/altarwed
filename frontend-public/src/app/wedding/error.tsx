'use client'

import Link from 'next/link'

// Error boundary for the /wedding subtree (issue #148). It lives in the PARENT
// `wedding/` segment on purpose: getWedding() now THROWS on transient backend
// failures (5xx/network/malformed body) instead of returning a false 404, and
// the dominant throw path is wedding/[slug]/layout.tsx (both generateMetadata
// and the layout body). In the Next.js App Router a segment's own error.tsx sits
// INSIDE that segment's layout, so it cannot catch a throw from that same
// layout; the boundary must sit in a parent segment to wrap it. This one does.
//
// Copy is deliberately "temporary trouble, try again", NOT "this wedding does
// not exist" (that is not-found.tsx's job and would reintroduce the exact false
// 404 this issue fixes). error.tsx must be a Client Component per Next's rules.
export default function WeddingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen bg-[#fdfaf6] flex flex-col items-center justify-center px-6 text-center text-[#3b2f2f]">
      <p className="text-xs uppercase tracking-[0.3em] text-[#8a6a4a] mb-4">AltarWed</p>
      <h1 className="font-serif text-3xl sm:text-4xl font-bold mb-3">
        We&rsquo;re having trouble loading this page
      </h1>
      <p className="text-[#6b5b4a] max-w-xl mb-8">
        This is a temporary hiccup on our end, not a missing site. Please try
        again in a moment.
      </p>

      <button
        type="button"
        onClick={reset}
        className="inline-block rounded-lg bg-[#d4af6a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#b8954f] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6a4a] focus-visible:ring-offset-2"
      >
        Try again
      </button>

      <Link href="/" className="mt-10 text-sm text-[#8a6a4a] hover:text-[#3b2f2f] transition">
        ← Back to AltarWed
      </Link>
    </main>
  )
}
