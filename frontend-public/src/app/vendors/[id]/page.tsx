import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import InquiryForm from './InquiryForm'

interface Vendor {
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
}

const CATEGORY_LABELS: Record<string, string> = {
  PHOTOGRAPHER:   'Photographer',
  VIDEOGRAPHER:   'Videographer',
  FLORIST:        'Florist',
  CATERER:        'Caterer',
  VENUE:          'Venue',
  OFFICIANT:      'Officiant / Pastor',
  MUSIC:          'Music',
  CAKE:           'Cake & Desserts',
  HAIR_AND_MAKEUP:'Hair & Makeup',
  INVITATION:     'Invitations & Stationery',
  TRANSPORTATION: 'Transportation',
  COORDINATOR:    'Wedding Coordinator',
  OTHER:          'Other',
}

async function getVendor(id: string): Promise<Vendor | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/vendors/${id}`, { next: { revalidate: 120 } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error()
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const vendor = await getVendor(id)
  if (!vendor) return { title: 'Vendor Not Found | AltarWed' }
  const category = CATEGORY_LABELS[vendor.category] ?? vendor.category
  const url = `https://www.altarwed.com/vendors/${id}`
  const metaDesc = vendor.bio
    ?? `${vendor.businessName} is a ${category.toLowerCase()} serving ${vendor.city}, ${vendor.state}${vendor.isChristianOwned ? ', a Christian-owned business' : ''}.`
  return {
    title: `${vendor.businessName}: ${category} in ${vendor.city} | AltarWed`,
    description: metaDesc,
    alternates: { canonical: url },
    openGraph: {
      title: `${vendor.businessName}: ${category} in ${vendor.city}`,
      description: metaDesc,
      url,
      siteName: 'AltarWed',
      type: 'website',
    },
  }
}

export default async function VendorDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const vendor = await getVendor(id)
  if (!vendor) notFound()

  const category = CATEGORY_LABELS[vendor.category] ?? vendor.category
  const url = `https://www.altarwed.com/vendors/${id}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: vendor.businessName,
    description: vendor.bio ?? vendor.description ?? undefined,
    url: vendor.websiteUrl ?? url,
    telephone: vendor.phone ?? undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: vendor.city,
      addressRegion: vendor.state,
      addressCountry: 'US',
    },
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/vendors" className="inline-flex items-center gap-1 text-sm text-[#a08060] hover:text-[#3b2f2f] mb-8 transition">
          ← All vendors
        </Link>

        {/* Profile header */}
        <div className="flex items-start gap-6 mb-8">
          <div className="h-20 w-20 rounded-full bg-[#f5ede0] border-2 border-[#e8dcc8] flex items-center justify-center shrink-0">
            <span className="font-serif text-3xl text-[#a08060]">{vendor.businessName.charAt(0)}</span>
          </div>
          <div className="flex-1 pt-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#3b2f2f] mb-1">
              {vendor.businessName}
            </h1>
            <p className="text-[#d4af6a] font-medium text-sm uppercase tracking-wide mb-2">{category}</p>
            <p className="text-[#6b5344] text-sm">{vendor.city}, {vendor.state}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {vendor.isChristianOwned && (
                <span className="text-xs bg-[#d4af6a]/10 text-[#a08060] font-medium px-3 py-1 rounded-full border border-[#d4af6a]/30">
                  ✝ Christian-owned
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

        {/* About section — only shown when vendor has filled in their bio or description */}
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

        {/* Inquiry form, couples can contact vendors without an account.
            Persistence is deferred (Phase 8); email handles the round-trip. */}
        <div className="mb-8">
          <InquiryForm vendorId={vendor.id} vendorBusinessName={vendor.businessName} />
        </div>

        {/* Details card */}
        <div className="rounded-2xl border border-[#e8dcc8] bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-[#3b2f2f] mb-4">Details</h2>
          <dl className="space-y-3">
            <div className="flex gap-4">
              <dt className="text-sm text-[#a08060] w-24 shrink-0">Category</dt>
              <dd className="text-sm text-[#3b2f2f]">{category}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="text-sm text-[#a08060] w-24 shrink-0">Location</dt>
              <dd className="text-sm text-[#3b2f2f]">{vendor.city}, {vendor.state}</dd>
            </div>
            {vendor.priceTier && (
              <div className="flex gap-4">
                <dt className="text-sm text-[#a08060] w-24 shrink-0">Price range</dt>
                <dd className="text-sm text-[#3b2f2f]">{vendor.priceTier}</dd>
              </div>
            )}
            {vendor.phone && (
              <div className="flex gap-4">
                <dt className="text-sm text-[#a08060] w-24 shrink-0">Phone</dt>
                <dd className="text-sm text-[#3b2f2f]">
                  <a href={`tel:${vendor.phone}`} className="hover:text-[#d4af6a] transition">{vendor.phone}</a>
                </dd>
              </div>
            )}
            {vendor.websiteUrl && (
              <div className="flex gap-4">
                <dt className="text-sm text-[#a08060] w-24 shrink-0">Website</dt>
                <dd className="text-sm text-[#3b2f2f]">
                  <a
                    href={vendor.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#d4af6a] hover:underline break-all"
                  >
                    {vendor.websiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                </dd>
              </div>
            )}
            <div className="flex gap-4">
              <dt className="text-sm text-[#a08060] w-24 shrink-0">Faith</dt>
              <dd className="text-sm text-[#3b2f2f]">
                {vendor.isChristianOwned ? 'Christian-owned business' : 'Works with faith-based couples'}
              </dd>
            </div>
          </dl>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
