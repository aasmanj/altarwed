import { notFound } from 'next/navigation'
import { Hotel } from 'lucide-react'
import { getWedding } from '@/app/wedding/[slug]/data'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'

interface WeddingHotel {
  id: string
  name: string
  address: string | null
  bookingUrl: string | null
  blockRate: string | null
  distanceFromVenue: string | null
}

async function getHotels(websiteId: string): Promise<WeddingHotel[]> {
  try {
    const res = await fetch(`${API}/api/v1/wedding-websites/${websiteId}/hotels`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function TravelPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding || !wedding.isPublished) notFound()

  // Prefer multi-hotel table; fall back to legacy scalar fields for existing couples
  const hotels = await getHotels(wedding.id)
  const hasHotels = hotels.length > 0
  const hasLegacyHotel = !hasHotels && !!wedding.hotelName

  if (!hasHotels && !hasLegacyHotel) {
    return (
      <div className="text-center py-16 text-[#a08060]">
        <p className="font-serif text-2xl mb-2">Travel details coming soon…</p>
        <p className="text-sm">Hotel block and travel info will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <SectionHeading>Travel</SectionHeading>

      {/* Multi-hotel cards */}
      {hasHotels && (
        <div className="space-y-6">
          {hotels.map(hotel => (
            <div key={hotel.id} className="rounded-2xl border border-[#e8dcc8] bg-white p-8">
              <div className="flex items-start gap-5">
                <Hotel className="w-10 h-10 text-[#d4af6a] shrink-0" strokeWidth={1.5} />
                <div className="flex-1">
                  <p className="font-serif text-2xl font-semibold text-[#3b2f2f] mb-1">{hotel.name}</p>
                  {hotel.address && (
                    <p className="text-[#a08060] text-sm mb-3">{hotel.address}</p>
                  )}
                  <div className="flex flex-wrap gap-4 mb-4 text-sm">
                    {hotel.distanceFromVenue && (
                      <span className="text-[#6b5344]">📍 {hotel.distanceFromVenue} from venue</span>
                    )}
                    {hotel.blockRate && (
                      <span className="text-[#6b5344]">💰 {hotel.blockRate}</span>
                    )}
                  </div>
                  {hotel.bookingUrl && (
                    <a
                      href={hotel.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-lg bg-[#3b2f2f] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5c4033] transition"
                    >
                      Book your room →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legacy single-hotel fallback */}
      {hasLegacyHotel && (
        <div className="rounded-2xl border border-[#e8dcc8] bg-white p-8">
          <div className="flex items-start gap-5">
            <Hotel className="w-10 h-10 text-[#d4af6a] shrink-0" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="font-serif text-2xl font-semibold text-[#3b2f2f] mb-3">{wedding.hotelName}</p>
              {wedding.hotelDetails && (
                <p className="text-[#6b5344] leading-relaxed mb-5">{wedding.hotelDetails}</p>
              )}
              {wedding.hotelUrl && (
                <a
                  href={wedding.hotelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-[#3b2f2f] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5c4033] transition"
                >
                  Book your room →
                </a>
              )}
            </div>
          </div>
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
