import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { useGuests } from '@/features/couple/guests/useGuests'

export default function SaveTheDatePage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: website } = useWeddingWebsite(coupleId)
  const { data: guests = [] } = useGuests(coupleId)
  const [sent, setSent] = useState(false)

  const eligibleCount = guests.filter(g => g.email).length

  const sendMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/save-the-dates/couple/${coupleId}/send`).then(r => r.data),
    onSuccess: () => setSent(true),
  })

  const coupleNames = user?.partnerOneName && user?.partnerTwoName
    ? `${user.partnerOneName} & ${user.partnerTwoName}`
    : 'The Couple'
  const weddingDate = website?.weddingDate
    ? new Date(website.weddingDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'Date TBD'
  const weddingUrl = website
    ? `https://www.altarwed.com/wedding/${website.slug}`
    : 'https://www.altarwed.com'

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link to="/dashboard" className="text-sm text-stone-400 hover:text-stone-700 transition">← Dashboard</Link>
          <h1 className="text-2xl font-semibold text-stone-900">Save the Dates</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Email preview */}
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Email Preview</h2>
          <div className="bg-[#fdfaf6] rounded-2xl border border-[#e8dcc8] p-10 text-center shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[#a08060] mb-2">Save the Date</p>
            <p className="font-serif text-3xl font-bold text-[#3b2f2f] mb-1">{coupleNames.split(' & ')[0]}</p>
            <p className="font-serif text-xl text-[#d4af6a] mb-1">&amp;</p>
            <p className="font-serif text-3xl font-bold text-[#3b2f2f] mb-6">{coupleNames.split(' & ')[1] ?? ''}</p>
            <div className="border-t border-b border-[#e8dcc8] py-5 mb-6">
              <p className="text-[#a08060] text-sm mb-1">are getting married on</p>
              <p className="font-semibold text-[#3b2f2f]">{weddingDate}</p>
            </div>
            <p className="text-[#a08060] text-xs mb-4">Formal invitation to follow · Visit their wedding website ↓</p>
            <div className="inline-block px-8 py-3 bg-[#3b2f2f] text-[#d4af6a] rounded text-sm font-medium tracking-wide">
              Visit Our Wedding Website
            </div>
            <p className="mt-6 text-[#a08060] text-xs italic">
              "And over all these virtues put on love, which binds them all together in perfect unity." — Colossians 3:14
            </p>
          </div>
        </div>

        {/* Send panel */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-stone-900 mb-1">Send to your guest list</h2>
              <p className="text-sm text-stone-500">
                {eligibleCount === 0
                  ? 'No guests with email addresses yet. Add guests first.'
                  : `Will be sent to ${eligibleCount} guest${eligibleCount !== 1 ? 's' : ''} with email addresses.`}
              </p>
              {website && (
                <p className="text-xs text-stone-400 mt-1">
                  Includes link to: <span className="text-amber-600">{weddingUrl}</span>
                </p>
              )}
            </div>
            {sent ? (
              <div className="flex items-center gap-2 text-green-600 font-medium whitespace-nowrap">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Sent!
              </div>
            ) : (
              <button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || eligibleCount === 0}
                className="whitespace-nowrap px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {sendMutation.isPending ? 'Sending…' : 'Send Save-the-Dates'}
              </button>
            )}
          </div>
          {sent && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-700">
              Save-the-dates sent to {sendMutation.data?.sent ?? eligibleCount} guests.{' '}
              <Link to="/dashboard/guests" className="underline">View guest list</Link>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 text-sm text-amber-800 space-y-1">
          <p className="font-semibold mb-2">Tips</p>
          <p>· Send save-the-dates 6–12 months before the wedding for destination weddings, 4–6 months for local.</p>
          <p>· Make sure your wedding website is published before sending so guests can visit it.</p>
          <p>· Formal invitations with RSVP links can be sent separately from the Guest List page.</p>
        </div>
      </div>
    </div>
  )
}
