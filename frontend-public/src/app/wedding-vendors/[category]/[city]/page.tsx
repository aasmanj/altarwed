import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import {
  VENDOR_CATEGORY_LABELS,
  VENDOR_CATEGORY_PLURALS,
  categoryFromSlug,
  categorySlug as toCategorySlug,
  cityFromSlug,
  citySlug as toCitySlug,
  landingTitle,
  landingDescription,
  landingCanonical,
  locationLabel,
  titleCaseFromSlug,
  buildLandingItemListJsonLd,
} from '@/lib/vendorLanding'

// Vendor listings pick up new vendors quickly, so match the 15s ISR cadence the
// rest of the vendor surface uses (frontend-public/CLAUDE.md, "Vendor pages: 15s").
const REVALIDATE_SECONDS = 15

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'

// The backend directory caps a single (category, city) result set at 100 rows
// (VendorRepository.MAX_SEARCH_RESULTS) and 50 rows per page (VendorService.MAX_PAGE_SIZE),
// so two pages of 50 cover the whole window a landing page can ever show.
const PAGE_SIZE = 50
const MAX_PAGES = 2

interface LandingVendor {
  id: string
  businessName: string
  category: string
  city: string
  state: string
  isChristianOwned: boolean
  isVerified: boolean
  priceTier: string | null
  logoUrl: string | null
}

interface VendorPage {
  vendors: LandingVendor[]
  total: number
}

async function fetchVendorPage(categoryEnum: string, cityQuery: string, page: number): Promise<VendorPage> {
  const params = new URLSearchParams({
    category: categoryEnum,
    city: cityQuery,
    page: String(page),
    size: String(PAGE_SIZE),
  })
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors?${params}`, { next: { revalidate: REVALIDATE_SECONDS } })
    if (!res.ok) return { vendors: [], total: 0 }
    const data = await res.json()
    if (Array.isArray(data)) return { vendors: data, total: data.length }
    return { vendors: data.vendors ?? [], total: data.total ?? 0 }
  } catch {
    return { vendors: [], total: 0 }
  }
}

// Walk up to MAX_PAGES of the capped directory window and concatenate the rows.
async function getLandingVendors(categoryEnum: string, cityQuery: string): Promise<LandingVendor[]> {
  const collected: LandingVendor[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { vendors, total } = await fetchVendorPage(categoryEnum, cityQuery, page)
    collected.push(...vendors)
    if (collected.length >= total || vendors.length < PAGE_SIZE) break
  }
  return collected
}

interface LandingParams {
  params: Promise<{ category: string; city: string }>
}

// Resolve the (category, city) slugs into the enum + display strings the page and
// its metadata both need. Returns null when the category slug is not a real
// category or the combo has no listed vendors, so both entry points 404 cleanly.
async function resolveLanding(rawCategory: string, rawCity: string) {
  const categoryEnum = categoryFromSlug(rawCategory)
  if (!categoryEnum) return null

  const cityQuery = cityFromSlug(rawCity)
  const vendors = await getLandingVendors(categoryEnum, cityQuery)
  if (vendors.length === 0) return null

  const cityDisplay = vendors[0]?.city ?? titleCaseFromSlug(rawCity)
  const location = locationLabel(cityDisplay, vendors.map((v) => v.state))
  return { categoryEnum, categorySlug: toCategorySlug(categoryEnum), citySlug: toCitySlug(cityDisplay), cityDisplay, location, vendors }
}

export async function generateMetadata({ params }: LandingParams): Promise<Metadata> {
  const { category, city } = await params
  const resolved = await resolveLanding(category, city)
  if (!resolved) {
    return { title: 'Vendors Not Found | AltarWed', robots: { index: false, follow: false } }
  }
  const { categoryEnum, location } = resolved
  const canonical = landingCanonical(category, city)
  const title = landingTitle(categoryEnum, location)
  const description = landingDescription(categoryEnum, location)
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'AltarWed',
      type: 'website',
    },
  }
}

export default async function VendorCategoryCityPage({ params }: LandingParams) {
  const { category, city } = await params
  const resolved = await resolveLanding(category, city)
  if (!resolved) notFound()

  const { categoryEnum, cityDisplay, location, vendors } = resolved
  const plural = VENDOR_CATEGORY_PLURALS[categoryEnum] ?? 'Wedding Vendors'
  const jsonLd = buildLandingItemListJsonLd(categoryEnum, location, vendors)

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

      {/* Hero */}
      <section className="bg-[#3b2f2f] py-14 px-6 text-center">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-3">
          Christian Wedding {plural} in {location}
        </h1>
        <p className="text-[#fdfaf6]/70 text-base max-w-xl mx-auto">
          Faith-aligned {plural.toLowerCase()} serving couples in {cityDisplay}. Every listing is
          Christian-owned or works regularly with faith-based couples.
        </p>
      </section>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <nav className="mb-6 text-sm text-[#8a6a4a]" aria-label="Breadcrumb">
          <Link href="/vendors" className="hover:text-[#3b2f2f] hover:underline">
            All vendors
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-[#6b5344]">
            {VENDOR_CATEGORY_LABELS[categoryEnum] ?? categoryEnum} in {cityDisplay}
          </span>
        </nav>

        <p className="mb-5 text-sm text-[#8a6a4a]">
          {vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'} found
        </p>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0">
          {vendors.map((vendor) => (
            <li key={vendor.id}>
              <Link
                href={`/vendors/${vendor.id}`}
                className="rounded-2xl border border-[#e8dcc8] bg-white p-6 hover:border-[#d4af6a] hover:shadow-sm transition block h-full"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="h-12 w-12 rounded-full bg-[#f5ede0] border border-[#e8dcc8] flex items-center justify-center shrink-0 overflow-hidden">
                    {vendor.logoUrl
                      ? <img src={vendor.logoUrl} alt={`${vendor.businessName} logo`} className="h-full w-full object-cover" />
                      : <span className="font-serif text-xl text-[#8a6a4a]">{vendor.businessName.charAt(0)}</span>
                    }
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {vendor.isChristianOwned && (
                      <span className="text-xs bg-[#d4af6a]/10 text-[#8a6a4a] font-medium px-2 py-0.5 rounded-full">
                        Christian-owned
                      </span>
                    )}
                    {vendor.isVerified && (
                      <span className="text-xs bg-green-50 text-green-700 font-medium px-2 py-0.5 rounded-full">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
                <h2 className="font-serif font-semibold text-[#3b2f2f] mb-0.5">{vendor.businessName}</h2>
                <p className="text-xs text-[#d4af6a] font-medium uppercase tracking-wide mb-1">
                  {VENDOR_CATEGORY_LABELS[vendor.category] ?? vendor.category}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-[#8a6a4a]">{vendor.city}, {vendor.state}</p>
                  {vendor.priceTier && (
                    <span className="text-xs font-semibold text-[#6b5344]">{vendor.priceTier}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-[#8a6a4a]">
          Looking in another city?{' '}
          <Link href="/vendors" className="text-[#d4af6a] hover:underline">
            Browse the full vendor directory
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
