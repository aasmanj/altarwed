'use client'

import { useEffect, useState } from 'react'
import { getConsent, setConsent } from '@/lib/consent'

export default function DoNotSellClient() {
  const [status, setStatus] = useState<'loading' | 'opted-in' | 'opted-out'>('loading')

  useEffect(() => {
    const c = getConsent()
    setStatus(c === 'accepted' ? 'opted-in' : 'opted-out')
    const handler = () => {
      const updated = getConsent()
      setStatus(updated === 'accepted' ? 'opted-in' : 'opted-out')
    }
    window.addEventListener('altarwed_consent_change', handler)
    return () => window.removeEventListener('altarwed_consent_change', handler)
  }, [])

  if (status === 'loading') return null

  if (status === 'opted-out') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-sm text-green-800">
        <strong>You are currently opted out.</strong> Advertising cookies (Meta Pixel) and PostHog analytics
        are not active on your browser. Your preference is saved locally.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white px-6 py-5 space-y-4">
      <p className="text-sm text-[#3b2f2f]">
        You are currently opted in to analytics and advertising cookies. Click below to opt out.
        This will stop the Meta Pixel and PostHog analytics from loading on your browser.
      </p>
      <button
        onClick={() => setConsent('declined')}
        className="rounded-lg bg-[#3b2f2f] text-[#fdfaf6] px-5 py-2.5 text-sm font-semibold hover:bg-[#4a3c3c] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a]"
      >
        Opt Out of Selling / Sharing
      </button>
    </div>
  )
}
