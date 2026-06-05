'use client'

import { useEffect, useState } from 'react'
import { getConsent, setConsent, ConsentChoice } from '@/lib/consent'

export default function CookieConsentBanner() {
  const [choice, setChoice] = useState<ConsentChoice | 'loading'>('loading')

  useEffect(() => {
    setChoice(getConsent())
    const handler = () => setChoice(getConsent())
    window.addEventListener('altarwed_consent_change', handler)
    return () => window.removeEventListener('altarwed_consent_change', handler)
  }, [])

  // Don't flash the banner during SSR or while reading localStorage.
  if (choice !== null) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#3b2f2f] text-[#fdfaf6] shadow-lg"
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm leading-relaxed flex-1">
          We use analytics and advertising cookies (Meta Pixel, PostHog) to understand how couples find us and measure ad effectiveness.{' '}
          <a href="/privacy#8" className="underline hover:text-[#d4af6a]">Learn more</a>.
          California residents may opt out using the{' '}
          <a href="/do-not-sell" className="underline hover:text-[#d4af6a]">Do Not Sell or Share</a> link.
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => setConsent('declined')}
            className="rounded-md border border-[#fdfaf6]/40 px-4 py-2 text-sm font-medium hover:bg-[#fdfaf6]/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a]"
          >
            Decline
          </button>
          <button
            onClick={() => setConsent('accepted')}
            className="rounded-md bg-[#d4af6a] text-[#3b2f2f] px-4 py-2 text-sm font-semibold hover:bg-[#c49b55] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
