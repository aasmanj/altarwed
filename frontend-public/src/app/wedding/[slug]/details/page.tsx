import { notFound } from 'next/navigation'
import { Calendar, Clock, MapPin, Shirt } from 'lucide-react'
import { getWedding } from '@/app/wedding/[slug]/data'
import { formatWeddingDate as formatDate } from '@/lib/date'
import TabBlocks from '@/components/blocks/TabBlocks'

export default async function DetailsPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding) notFound()

  const fallback = (
    <div className="space-y-10">
      <SectionHeading>The Wedding</SectionHeading>

      <div className="grid sm:grid-cols-2 gap-4">
        {wedding.weddingDate && (
          <DetailCard label="Date" value={formatDate(wedding.weddingDate)} Icon={Calendar} />
        )}
        {wedding.ceremonyTime && (
          <DetailCard label="Ceremony Time" value={wedding.ceremonyTime} Icon={Clock} />
        )}
        {wedding.venueName && (
          <DetailCard
            label="Venue"
            value={[wedding.venueName, wedding.venueAddress, wedding.venueCity, wedding.venueState].filter(Boolean).join(', ')}
            Icon={MapPin}
          />
        )}
        {wedding.dressCode && (
          <DetailCard label="Dress Code" value={wedding.dressCode} Icon={Shirt} />
        )}
      </div>

      {wedding.rsvpDeadline && (
        <div className="rounded-2xl bg-[#3b2f2f] text-white px-8 py-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-on-dark)] mb-2">RSVP Deadline</p>
          <p className="font-serif text-2xl font-bold">{formatDate(wedding.rsvpDeadline)}</p>
          <p className="mt-2 text-sm text-white/60">Check your email for your personal RSVP link.</p>
        </div>
      )}
    </div>
  )

  return <TabBlocks slug={slug} tab="DETAILS" wedding={wedding} fallback={fallback} />
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center">
      <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f]">{children}</h2>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="h-px w-10 bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]" />
        <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        <div className="h-px w-10 bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]" />
      </div>
    </div>
  )
}

function DetailCard({ label, value, Icon }: { label: string; value: string; Icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white p-5 flex gap-4 items-start">
      <Icon className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" strokeWidth={1.5} />
      <div>
        <p className="text-xs uppercase tracking-widest text-[#8a6a4a] mb-1">{label}</p>
        <p className="font-medium text-[#3b2f2f] text-sm leading-snug">{value}</p>
      </div>
    </div>
  )
}
