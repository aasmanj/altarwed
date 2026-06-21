import { notFound } from 'next/navigation'
import { Camera } from 'lucide-react'
import { getWedding } from '@/app/wedding/[slug]/data'
import { framingStyle } from '@/lib/imageFraming'

interface WeddingPhoto {
  id: string
  url: string
  caption: string | null
  sortOrder: number
  // Non-destructive framing (backend V70). null = centered / no zoom.
  focalPointX: number | null
  focalPointY: number | null
  zoom: number | null
}

async function getPhotos(slug: string): Promise<WeddingPhoto[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-photos/website/slug/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function PhotosPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const [wedding, photos] = await Promise.all([getWedding(slug), getPhotos(slug)])
  if (!wedding) notFound()

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f]">Photos</h2>
        <div className="mt-3 flex items-center justify-center gap-3">
          <div className="h-px w-10 bg-[#d4af6a]/40" />
          <div className="h-1.5 w-1.5 rounded-full bg-[#d4af6a]" />
          <div className="h-px w-10 bg-[#d4af6a]/40" />
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="w-12 h-12 text-stone-300 mx-auto mb-4" strokeWidth={1.5} />
          <p className="font-serif text-2xl text-[#8a6a4a] mb-2">Photos coming soon</p>
          <p className="text-sm text-[#8a6a4a]">
            {wedding.partnerTwoName} & {wedding.partnerOneName} will share photos here.
          </p>
        </div>
      ) : (
        // Uniform square grid (not masonry) so each photo honors the framing the couple
        // set in the dashboard. Center-crop is the default; the couple repositions any
        // photo that crops awkwardly. The anchor opens the full, uncropped original.
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map(photo => (
            <div key={photo.id} className="rounded-xl overflow-hidden shadow-sm border border-[#e8dcc8] bg-white">
              <a
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? `${wedding.partnerTwoName} and ${wedding.partnerOneName}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full"
                  style={framingStyle(photo)}
                />
              </a>
              {photo.caption && (
                <div className="px-3 py-2">
                  <p className="text-xs text-[#8a6a4a] leading-relaxed">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
