import { notFound } from 'next/navigation'
import { Camera } from 'lucide-react'
import { getWedding } from '@/app/wedding/[slug]/data'
import TabBlocks from '@/components/blocks/TabBlocks'
import PhotoGalleryClient, { type WeddingPhoto } from './PhotoGalleryClient'

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

  // Legacy scalar render (the existing photo grid + "coming soon" empty state).
  // This becomes the zero-block fallback so a couple who uploaded photos but has
  // not added any Photos-tab blocks yet renders byte-for-byte unchanged. When the
  // couple DOES add content-bearing blocks on the Photos tab (HEADING, TEXT,
  // DIVIDER, PHOTO_ALBUM_GRID), TabBlocks renders those instead, matching how
  // Home/Story/Details/Registry already flow through the block pipeline (#332).
  const fallback = (
    <div className="space-y-10">
      <div className="text-center">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#3b2f2f]">Photos</h2>
        <div className="mt-3 flex items-center justify-center gap-3">
          <div className="h-px w-10 bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          <div className="h-px w-10 bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]" />
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
        <PhotoGalleryClient
          photos={photos}
          coupleNames={`${wedding.partnerTwoName} and ${wedding.partnerOneName}`}
        />
      )}
    </div>
  )

  return <TabBlocks slug={slug} tab="PHOTOS" wedding={wedding} fallback={fallback} />
}
