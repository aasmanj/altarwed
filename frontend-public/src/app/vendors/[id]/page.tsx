import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

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
  if (!vendor) return { title: 'Vendor Not Found — AltarWed' }
  const category = CATEGORY_LABELS[vendor.category] ?? vendor.category
  return {
    title: `${vendor.businessName} — ${category} in ${vendor.city} — AltarWed`,
    description: `${vendor.businessName} is a ${category.toLowerCase()} serving ${vendor.city}, ${vendor.state}${vendor.isChristianOwned ? ', a Christian-owned business' : ''}.`,
  }
}

export default async function VendorDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const vendor = await getVendor(id)
  if (!vendor) notFound()

  const category = CATEGORY_LABELS[vendor.category] ?? vendor.category

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
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

        {/* Contact CTA */}
        <div className="rounded-2xl border border-[#e8dcc8] bg-white p-6 mb-8">
          <p className="font-serif text-lg font-semibold text-[#3b2f2f] mb-1">Interested in this vendor?</p>
          <p className="text-sm text-[#6b5344] mb-4">
            Create a free AltarWed account to send an inquiry and manage your wedding in one place.
          </p>
          <a
            href="https://app.altarwed.com/register"
            className="inline-block rounded-xl bg-[#3b2f2f] px-6 py-2.5 font-semibold text-white hover:bg-[#5c4033] transition text-sm"
          >
            Start planning for free →
          </a>
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
