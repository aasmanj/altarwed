import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import VendorPageClient, { type Vendor, type PortfolioPhoto } from './VendorPageClient'

const CATEGORY_LABELS: Record<string, string> = {
  PHOTOGRAPHER:    'Photographer',
  VIDEOGRAPHER:    'Videographer',
  FLORIST:         'Florist',
  CATERER:         'Caterer',
  VENUE:           'Venue',
  OFFICIANT:       'Officiant / Pastor',
  MUSIC:           'Music',
  CAKE:            'Cake & Desserts',
  HAIR_AND_MAKEUP: 'Hair & Makeup',
  INVITATION:      'Invitations & Stationery',
  TRANSPORTATION:  'Transportation',
  COORDINATOR:     'Wedding Coordinator',
  COUNSELING:      'Pre-Marital Counseling',
  OTHER:           'Other',
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'

async function getVendor(id: string): Promise<Vendor | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/${id}`, { next: { revalidate: 15 } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error()
    return res.json()
  } catch {
    return null
  }
}

async function getPortfolioPhotos(id: string): Promise<PortfolioPhoto[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/${id}/portfolio-photos`, { next: { revalidate: 15 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const [vendor, portfolioPhotos] = await Promise.all([getVendor(id), getPortfolioPhotos(id)])
  if (!vendor) return { title: 'Vendor Not Found | AltarWed' }
  const category = CATEGORY_LABELS[vendor.category] ?? vendor.category
  const url = `https://www.altarwed.com/vendors/${id}`
  const metaDesc = vendor.bio
    ?? `${vendor.businessName} is a ${category.toLowerCase()} serving ${vendor.city}, ${vendor.state}${vendor.isChristianOwned ? ', a Christian-owned business' : ''}.`
  const ogImage = portfolioPhotos[0]?.photoUrl ?? vendor.logoUrl ?? undefined
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
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  }
}

export default async function VendorDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [vendor, portfolioPhotos] = await Promise.all([getVendor(id), getPortfolioPhotos(id)])
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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />
      <SiteHeader />
      <VendorPageClient vendor={vendor} portfolioPhotos={portfolioPhotos} category={category} />
      <SiteFooter />
    </div>
  )
}
