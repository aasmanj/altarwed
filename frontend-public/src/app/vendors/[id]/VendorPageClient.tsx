'use client'

import Link from 'next/link'
import InquiryForm from './InquiryForm'
import { useLightbox, LightboxFrame } from '@/components/Lightbox'

export interface PortfolioPhoto {
  id: string
  photoUrl: string
  caption: string | null
  sortOrder: number
}

export interface Vendor {
  id: string
  businessName: string
  category: string
  city: string
  state: string
  isChristianOwned: boolean
  isVerified: boolean
  priceTier: string | null
  bio: string | null
  description: string | null
  websiteUrl: string | null
  phone: string | null
  logoUrl: string | null
  contactEmail: string | null
}

interface Props {
  vendor: Vendor
  portfolioPhotos: PortfolioPhoto[]
  category: string
}

export default function VendorPageClient({ vendor, portfolioPhotos, category }: Props) {
  const { index: lightboxIndex, open: openLightbox, close: closeLightbox, goPrev, goNext, lightboxRef, closeButtonRef } =
    useLightbox(portfolioPhotos.length)

  const bannerPhotos = portfolioPhotos.slice(0, 3)
  // Only render website link for http/https URLs to prevent javascript: injection.
  const safeWebsiteUrl = vendor.websiteUrl && /^https?:\/\//i.test(vendor.websiteUrl)
    ? vendor.websiteUrl
    : null

  const bannerCols =
    bannerPhotos.length === 1 ? 'grid-cols-1' :
    bannerPhotos.length === 2 ? 'grid-cols-2' :
    'grid-cols-3'

  const currentPhoto = lightboxIndex !== null ? portfolioPhotos[lightboxIndex] : null

  return (
    <>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/vendors"
          className="inline-flex items-center gap-1 text-sm text-[#8a6a4a] hover:text-[#3b2f2f] mb-8 transition"
          aria-label="Back to all vendors"
        >
          <span aria-hidden="true">←</span> All vendors
        </Link>

        <div className="flex items-start gap-6 mb-8">
          <div className="h-20 w-20 rounded-full bg-[#f5ede0] border-2 border-[#e8dcc8] flex items-center justify-center shrink-0 overflow-hidden">
            {vendor.logoUrl
              ? <img src={vendor.logoUrl} alt={`${vendor.businessName} logo`} className="h-full w-full object-cover" />
              : <span className="font-serif text-3xl text-[#8a6a4a]">{vendor.businessName.charAt(0)}</span>
            }
          </div>
          <div className="flex-1 pt-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#3b2f2f] mb-1">
              {vendor.businessName}
            </h1>
            <p className="text-[#d4af6a] font-medium text-sm uppercase tracking-wide mb-2">{category}</p>
            <p className="text-[#6b5344] text-sm">{vendor.city}, {vendor.state}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {vendor.isChristianOwned && (
                <span className="text-xs bg-[#d4af6a]/10 text-[#8a6a4a] font-medium px-3 py-1 rounded-full border border-[#d4af6a]/30">
                  Christian-owned
                </span>
              )}
              {vendor.isVerified && (
                <span className="text-xs bg-green-50 text-green-700 font-medium px-3 py-1 rounded-full border border-green-200">
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>

        {bannerPhotos.length > 0 && (
          <div className={`-mx-6 grid h-52 sm:h-64 overflow-hidden mb-8 ${bannerCols}`}>
            {bannerPhotos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={e => openLightbox(idx, e.currentTarget)}
                className="relative overflow-hidden group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#d4af6a]"
                aria-label={`View photo ${idx + 1} of ${vendor.businessName} portfolio`}
              >
                <img
                  src={photo.photoUrl}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}

        {(vendor.bio || vendor.description) && (
          <div className="mb-8 rounded-2xl border border-[#e8dcc8] bg-white p-6">
            <h2 className="font-serif text-lg font-semibold text-[#3b2f2f] mb-3">About</h2>
            {vendor.bio && (
              <p className="text-[#3b2f2f] font-medium mb-3">{vendor.bio}</p>
            )}
            {vendor.description && (
              <p className="text-[#6b5344] text-sm whitespace-pre-line">{vendor.description}</p>
            )}
          </div>
        )}

        <div className="mb-8">
          <InquiryForm vendorId={vendor.id} vendorBusinessName={vendor.businessName} />
        </div>

        {portfolioPhotos.length > 0 && (
          <div className="mb-8 rounded-2xl border border-[#e8dcc8] bg-white p-6">
            <h2 className="font-serif text-lg font-semibold text-[#3b2f2f] mb-4">Portfolio</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {portfolioPhotos.map((photo, idx) => (
                <button
                  key={photo.id}
                  onClick={e => openLightbox(idx, e.currentTarget)}
                  className="overflow-hidden rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d4af6a]"
                  aria-label={photo.caption ?? `${vendor.businessName} portfolio photo ${idx + 1}`}
                >
                  <img
                    src={photo.photoUrl}
                    alt=""
                    loading="lazy"
                    className="w-full aspect-square object-cover border border-[#e8dcc8] hover:opacity-90 transition-opacity"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[#e8dcc8] bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-[#3b2f2f] mb-4">Details</h2>
          <dl className="space-y-3">
            <div className="flex gap-4">
              <dt className="text-sm text-[#8a6a4a] w-24 shrink-0">Category</dt>
              <dd className="text-sm text-[#3b2f2f]">{category}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="text-sm text-[#8a6a4a] w-24 shrink-0">Location</dt>
              <dd className="text-sm text-[#3b2f2f]">{vendor.city}, {vendor.state}</dd>
            </div>
            {vendor.priceTier && (
              <div className="flex gap-4">
                <dt className="text-sm text-[#8a6a4a] w-24 shrink-0">Price range</dt>
                <dd className="text-sm text-[#3b2f2f]">{vendor.priceTier}</dd>
              </div>
            )}
            {vendor.phone && (
              <div className="flex gap-4">
                <dt className="text-sm text-[#8a6a4a] w-24 shrink-0">Phone</dt>
                <dd className="text-sm text-[#3b2f2f]">
                  <a href={`tel:${vendor.phone}`} className="hover:text-[#d4af6a] transition">{vendor.phone}</a>
                </dd>
              </div>
            )}
            {vendor.contactEmail && (
              <div className="flex gap-4">
                <dt className="text-sm text-[#8a6a4a] w-24 shrink-0">Email</dt>
                <dd className="text-sm text-[#3b2f2f]">
                  <a href={`mailto:${vendor.contactEmail}`} className="hover:text-[#d4af6a] transition break-all">
                    {vendor.contactEmail}
                  </a>
                </dd>
              </div>
            )}
            {safeWebsiteUrl && (
              <div className="flex gap-4">
                <dt className="text-sm text-[#8a6a4a] w-24 shrink-0">Website</dt>
                <dd className="text-sm text-[#3b2f2f]">
                  <a
                    href={safeWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#d4af6a] hover:underline break-all"
                  >
                    {safeWebsiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                </dd>
              </div>
            )}
            <div className="flex gap-4">
              <dt className="text-sm text-[#8a6a4a] w-24 shrink-0">Faith</dt>
              <dd className="text-sm text-[#3b2f2f]">
                {vendor.isChristianOwned ? 'Christian-owned business' : 'Works with faith-based couples'}
              </dd>
            </div>
          </dl>
        </div>
      </main>

      {currentPhoto !== null && lightboxIndex !== null && (
        <LightboxFrame
          index={lightboxIndex}
          count={portfolioPhotos.length}
          ariaLabel={`Portfolio viewer: photo ${lightboxIndex + 1} of ${portfolioPhotos.length}`}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
          lightboxRef={lightboxRef}
          closeButtonRef={closeButtonRef}
        >
          <img
            src={currentPhoto.photoUrl}
            alt={currentPhoto.caption ?? `${vendor.businessName} portfolio photo ${lightboxIndex + 1}`}
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
