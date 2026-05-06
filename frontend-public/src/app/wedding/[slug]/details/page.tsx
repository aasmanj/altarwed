import { notFound } from 'next/navigation'
import { getWedding } from '../data'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function DetailsPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding || !wedding.isPublished) notFound()

  return (
    <div className="space-y-10">
      <SectionHeading>The Wedding</SectionHeading>

      <div className="grid sm:grid-cols-2 gap-4">
        {wedding.weddingDate && (
          <DetailCard label="Date" value={formatDate(wedding.weddingDate)} icon="📅" />
        )}
        {wedding.ceremonyTime && (
          <DetailCard label="Ceremony Time" value={wedding.ceremonyTime} icon="🕐" />
        )}
        {wedding.venueName && (
          <DetailCard
            label="Venue"
            value={[wedding.venueName, wedding.venueAddress, wedding.venueCity, wedding.venueState].filter(Boolean).join(', ')}
            icon="📍"
          />
        )}
        {wedding.dressCode && (
          <DetailCard label="Dress Code" value={wedding.dressCode} icon="👗" />
        )}
      </div>

      {wedding.rsvpDeadline && (
        <div className="rounded-2xl bg-[#3b2f2f] text-white px-8 py-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[#d4af6a] mb-2">RSVP Deadline</p>
          <p className="font-serif text-2xl font-bold">{formatDate(wedding.rsvpDeadline)}</p>
          <p className="mt-2 text-sm text-white/60">Check your email for your personal RSVP link.</p>
        </div>
      )}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center">
      <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f]">{children}</h2>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="h-px w-10 bg-[#d4af6a]/40" />
        <div className="h-1.5 w-1.5 rounded-full bg-[#d4af6a]" />
        <div className="h-px w-10 bg-[#d4af6a]/40" />
      </div>
    </div>
  )
}

function DetailCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white p-5 flex gap-4 items-start">
      <span className="text-xl mt-0.5">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-widest text-[#a08060] mb-1">{label}</p>
        <p className="font-medium text-[#3b2f2f] text-sm leading-snug">{value}</p>
      </div>
    </div>
  )
}
