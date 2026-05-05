import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import RsvpForm from './RsvpForm'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'

interface RsvpPageData {
  guestName: string
  coupleNames: string
  weddingDate: string | null
  venueName: string | null
  venueCity: string | null
  venueState: string | null
  plusOneAllowed: boolean
}

async function getRsvpData(token: string): Promise<RsvpPageData | null> {
  try {
    const res = await fetch(`${API}/api/v1/guests/rsvp/${token}`, { cache: 'no-store' })
    if (res.status === 400 || res.status === 404) return null
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params
  const data = await getRsvpData(token)
  if (!data) return { title: 'RSVP — AltarWed' }
  return {
    title: `RSVP to ${data.coupleNames}'s Wedding — AltarWed`,
    description: `${data.guestName}, you're invited to celebrate ${data.coupleNames}${data.weddingDate ? ` on ${data.weddingDate}` : ''}.`,
  }
}

export default async function RsvpPage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const data = await getRsvpData(token)

  if (!data) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="font-serif text-2xl font-bold text-[#3b2f2f]">This link has expired</h1>
          <p className="text-[#6b5344]">
            This RSVP link is no longer valid. Please contact the couple directly for a new invite.
          </p>
        </div>
      </div>
    )
  }

  const venue = [data.venueName, data.venueCity, data.venueState].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
      {/* Header */}
      <div className="bg-[#3b2f2f] py-12 px-6 text-center">
        <p className="text-[#d4af6a] text-xs uppercase tracking-widest mb-3">You're invited</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">
          {data.coupleNames}
        </h1>
        {data.weddingDate && (
          <p className="text-white/80 text-sm mt-2">{data.weddingDate}</p>
        )}
        {venue && (
          <p className="text-white/60 text-sm mt-1">{venue}</p>
        )}
      </div>

      {/* RSVP card */}
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-[#e8dcc8] shadow-sm p-8">
          <p className="text-[#6b5344] mb-6 text-center">
            Dear <strong className="text-[#3b2f2f]">{data.guestName}</strong>, please let us know if you'll be joining us.
          </p>
          <RsvpForm token={token} plusOneAllowed={data.plusOneAllowed} apiUrl={API} />
        </div>
      </div>

      <footer className="text-center text-xs text-[#a08060] pb-10">
        Powered by <a href="https://www.altarwed.com" className="hover:underline">AltarWed</a>
      </footer>
    </div>
  )
}
