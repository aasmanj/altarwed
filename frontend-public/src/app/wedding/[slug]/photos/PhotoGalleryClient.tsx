'use client'

import { framingStyle } from '@/lib/imageFraming'
import { useLightbox, LightboxFrame } from '@/components/Lightbox'

export interface WeddingPhoto {
  id: string
  url: string
  caption: string | null
  sortOrder: number
  focalPointX: number | null
  focalPointY: number | null
  zoom: number | null
}

interface Props {
  photos: WeddingPhoto[]
  coupleNames: string
}

// Full-screen lightbox with prev/next nav (shared with the vendor portfolio viewer via
// src/components/Lightbox.tsx), so guests get an in-page viewer instead of a photo opening
// in a new browser tab and losing their place in the gallery.
export default function PhotoGalleryClient({ photos, coupleNames }: Props) {
  const { index, open, close, goPrev, goNext, lightboxRef, closeButtonRef } = useLightbox(photos.length)
  const currentPhoto = index !== null ? photos[index] : null

  return (
    <>
      {/* Uniform square grid (not masonry) so each photo honors the framing the couple
          set in the dashboard. Center-crop is the default; the lightbox shows the full,
          uncropped original. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo, idx) => (
          <div key={photo.id} className="rounded-xl overflow-hidden shadow-sm border border-[#e8dcc8] bg-white">
            <button
              onClick={e => open(idx, e.currentTarget)}
              className="block w-full aspect-square overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={photo.caption ?? `View photo ${idx + 1} of ${coupleNames}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full"
                style={framingStyle(photo)}
              />
            </button>
            {photo.caption && (
              <div className="px-3 py-2">
                <p className="text-xs text-[#8a6a4a] leading-relaxed">{photo.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {currentPhoto !== null && index !== null && (
        <LightboxFrame
          index={index}
          count={photos.length}
          ariaLabel={`Photo viewer: photo ${index + 1} of ${photos.length}`}
          onClose={close}
          onPrev={goPrev}
          onNext={goNext}
          lightboxRef={lightboxRef}
          closeButtonRef={closeButtonRef}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPhoto.url}
            alt={currentPhoto.caption ?? `${coupleNames}, photo ${index + 1}`}
            className="max-h-[80vh] max-w-full object-contain rounded-lg"
          />
          {currentPhoto.caption && (
            <p className="text-white/80 text-sm text-center">{currentPhoto.caption}</p>
          )}
        </LightboxFrame>
      )}
    </>
  )
}
