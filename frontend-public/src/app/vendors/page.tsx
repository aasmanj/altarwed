import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Find Christian Wedding Vendors — AltarWed',
  description: 'Browse faith-aligned photographers, florists, venues, officiants, and more for your Christian wedding.',
}

interface Vendor {
  id: string
  businessName: string
  category: string
  city: string
  state: string
  isChristianOwned: boolean
  isVerified: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  PHOTOGRAPHER:   'Photographer',
  VIDEOGRAPHER:   'Videographer',
  FLORIST:        'Florist',
  CATERER:        'Caterer',
  VENUE:          'Venue',
  OFFICIANT:      'Officiant',
  MUSIC:          'Music',
  CAKE:           'Cake',
  HAIR_AND_MAKEUP:'Hair & Makeup',
  INVITATION:     'Invitations',
  TRANSPORTATION: 'Transportation',
  COORDINATOR:    'Coordinator',
  OTHER:          'Other',
}

async function getVendors(category?: string, city?: string): Promise<Vendor[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (city) params.set('city', city)
  // Short cache — new vendors should appear within 15 seconds
  try {
    const res = await fetch(`${apiUrl}/api/v1/vendors?${params}`, { next: { revalidate: 15 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; city?: string }>
}) {
  const { category, city } = await searchParams
  const vendors = await getVendors(category, city)

  const categories = Object.entries(CATEGORY_LABELS)

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
      <SiteHeader />

      {/* Hero */}
      <section className="bg-[#3b2f2f] py-14 px-6 text-center">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-3">
          Faith-first wedding vendors
        </h1>
        <p className="text-[#fdfaf6]/70 text-base max-w-xl mx-auto">
          Every vendor here has been listed by a Christian business owner or works regularly with faith-based couples.
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <FilterChip label="All" href="/vendors" active={!category} />
          {categories.map(([val, label]) => (
            <FilterChip
              key={val}
              label={label}
              href={`/vendors?category=${val}${city ? `&city=${city}` : ''}`}
              active={category === val}
            />
          ))}
        </div>

        {/* City search */}
        <form method="GET" action="/vendors" className="flex gap-3 mb-8 max-w-sm">
          <input
            name="city"
            defaultValue={city}
            placeholder="Filter by city…"
            className="flex-1 rounded-lg border border-[#e8dcc8] px-4 py-2 text-sm text-[#3b2f2f] focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a]"
          />
          {category && <input type="hidden" name="category" value={category} />}
          <button type="submit"
            className="rounded-lg bg-[#3b2f2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c4033] transition">
            Search
          </button>
          {city && (
            <Link href={`/vendors${category ? `?category=${category}` : ''}`}
              className="rounded-lg border border-[#e8dcc8] px-4 py-2 text-sm text-[#a08060] hover:text-[#3b2f2f] transition">
              Clear
            </Link>
          )}
        </form>

        {/* Grid */}
        {vendors.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#a08060] text-lg mb-2">No vendors listed yet in this area</p>
            <p className="text-sm text-[#a08060]">
              Are you a vendor?{' '}
              <a href="https://app.altarwed.com/register/vendor" className="text-[#d4af6a] hover:underline">
                List your business →
              </a>
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vendors.map(vendor => (
              <Link
                key={vendor.id}
                href={`/vendors/${vendor.id}`}
                className="rounded-2xl border border-[#e8dcc8] bg-white p-6 hover:border-[#d4af6a] hover:shadow-sm transition block"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="h-12 w-12 rounded-full bg-[#f5ede0] border border-[#e8dcc8] flex items-center justify-center shrink-0">
                    <span className="font-serif text-xl text-[#a08060]">{vendor.businessName.charAt(0)}</span>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {vendor.isChristianOwned && (
                      <span className="text-xs bg-[#d4af6a]/10 text-[#a08060] font-medium px-2 py-0.5 rounded-full">
                        ✝ Christian-owned
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
                  {CATEGORY_LABELS[vendor.category] ?? vendor.category}
                </p>
                <p className="text-sm text-[#a08060]">{vendor.city}, {vendor.state}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  )
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-[#3b2f2f] text-white'
          : 'border border-[#e8dcc8] text-[#6b5344] hover:border-[#d4af6a]'
      }`}
    >
      {label}
    </Link>
  )
}
