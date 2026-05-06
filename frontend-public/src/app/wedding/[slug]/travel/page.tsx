import { notFound } from 'next/navigation'
import { getWedding } from '../layout'

export default async function TravelPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const wedding = await getWedding(slug)
  if (!wedding || !wedding.isPublished) notFound()

  if (!wedding.hotelName) {
    return (
      <div className="text-center py-16 text-[#a08060]">
        <p className="font-serif text-2xl mb-2">Travel details coming soon…</p>
        <p className="text-sm">Hotel block and travel info will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <SectionHeading>Where to Stay</SectionHeading>

      <div className="rounded-2xl border border-[#e8dcc8] bg-white p-8">
        <div className="flex items-start gap-5">
          <div className="text-4xl">🏨</div>
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
