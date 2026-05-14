import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BookHeart, Calendar, Camera, Clock, Gift, Heart, Hotel, MapPin, PenLine, Shirt, Users } from 'lucide-react'
import { getWedding } from '@/app/wedding/[slug]/data'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

export default async function WeddingHomePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding || !wedding.isPublished) notFound()

  const countdown = wedding.weddingDate ? daysUntil(wedding.weddingDate) : null
  const base = `/wedding/${slug}`

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <div className="text-center">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f]">
          We&rsquo;re getting married!
        </h2>
        <div className="mt-3 flex items-center justify-center gap-3">
          <div className="h-px w-10 bg-[#d4af6a]/40" />
          <div className="h-1.5 w-1.5 rounded-full bg-[#d4af6a]" />
          <div className="h-px w-10 bg-[#d4af6a]/40" />
        </div>
      </div>

      {/* Quick details */}
      <div className="grid sm:grid-cols-2 gap-4">
        {wedding.weddingDate && (
          <QuickCard Icon={Calendar} label="Wedding Date" value={formatDate(wedding.weddingDate)} />
        )}
        {wedding.ceremonyTime && (
          <QuickCard Icon={Clock} label="Ceremony Time" value={wedding.ceremonyTime} />
        )}
        {wedding.venueName && (
          <QuickCard
            Icon={MapPin}
            label="Venue"
            value={[wedding.venueName, wedding.venueCity, wedding.venueState].filter(Boolean).join(', ')}
          />
        )}
        {wedding.dressCode && (
          <QuickCard Icon={Shirt} label="Dress Code" value={wedding.dressCode} />
        )}
      </div>

      {/* Countdown */}
      {countdown !== null && countdown > 0 && (
        <div className="rounded-2xl bg-[#3b2f2f] text-white text-center py-10 px-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[#d4af6a]/80 mb-2">Counting down</p>
          <p className="font-serif text-7xl font-bold text-[#d4af6a]">{countdown}</p>
          <p className="mt-1 text-white/70 text-sm uppercase tracking-widest">days</p>
        </div>
      )}
      {countdown !== null && countdown <= 0 && (
        <div className="rounded-2xl bg-[#3b2f2f] text-white text-center py-10 px-6">
          <p className="font-serif text-3xl font-bold text-[#d4af6a]">We&rsquo;re married!</p>
          <p className="mt-2 text-white/70 text-sm">Thank you for being part of our covenant celebration.</p>
        </div>
      )}

      {/* RSVP callout */}
      <div className="rounded-2xl border-2 border-[#d4af6a] bg-[#d4af6a]/5 p-8 text-center">
        <p className="font-serif text-2xl font-bold text-[#3b2f2f] mb-2">Will you join us?</p>
        {wedding.rsvpDeadline && (
          <p className="text-sm text-[#a08060] mb-4">Please RSVP by {formatDate(wedding.rsvpDeadline)}</p>
        )}
        <p className="text-sm text-[#6b5344] mb-6">
          Check your email for your personal RSVP invitation link.
        </p>
      </div>

      {/* Explore links */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#a08060] text-center mb-5">Explore</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { label: 'Our Story',    href: `${base}/story`,         Icon: PenLine,   show: !!(wedding.ourStory || wedding.testimony) },
            { label: 'The Wedding',  href: `${base}/details`,        Icon: BookHeart, show: !!(wedding.venueName || wedding.ceremonyTime) },
            { label: 'Wedding Party',href: `${base}/wedding-party`,  Icon: Users,     show: true },
            { label: 'Registry',     href: `${base}/registry`,       Icon: Gift,      show: !!(wedding.registryUrl1) },
            { label: 'Travel',       href: `${base}/travel`,         Icon: Hotel,     show: !!(wedding.hotelName) },
            { label: 'Photos',       href: `${base}/photos`,         Icon: Camera,    show: true },
            { label: 'Prayers',      href: `${base}/prayers`,        Icon: Heart,     show: true },
          ] as const).filter(l => l.show).map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-[#e8dcc8] bg-white p-4 text-center hover:border-[#d4af6a] hover:shadow-sm transition group"
            >
              <div className="flex justify-center mb-2 text-[#d4af6a]">
                <link.Icon className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <p className="text-xs font-medium text-[#6b5344] group-hover:text-[#3b2f2f] transition">{link.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuickCard({ Icon, label, value }: { Icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e8dcc8] bg-white p-5 flex gap-4 items-start">
      <Icon className="w-5 h-5 text-[#d4af6a] shrink-0 mt-0.5" strokeWidth={1.5} />
      <div>
        <p className="text-xs uppercase tracking-widest text-[#a08060] mb-1">{label}</p>
        <p className="font-medium text-[#3b2f2f] text-sm leading-snug">{value}</p>
      </div>
    </div>
  )
}
