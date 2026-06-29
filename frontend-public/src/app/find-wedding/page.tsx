import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { formatShortDate } from '@/lib/date'

export const metadata: Metadata = {
  title: 'Find a Wedding | AltarWed',
  description: 'Search for a couple\'s wedding website by name or wedding year on AltarWed.',
  alternates: { canonical: 'https://www.altarwed.com/find-wedding' },
  openGraph: {
    title: 'Find a Wedding | AltarWed',
    description: 'Search for a couple\'s wedding website by name or wedding year.',
    url: 'https://www.altarwed.com/find-wedding',
    siteName: 'AltarWed',
    type: 'website',
  },
}

interface SearchResult {
  slug: string
  partnerOneName: string
  partnerTwoName: string
  weddingDate: string | null
  venueCity: string | null
  venueState: string | null
}

async function searchWeddings(name: string, year: string): Promise<SearchResult[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  const params = new URLSearchParams()
  if (name) params.set('name', name)
  if (year) params.set('year', year)
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-websites/search?${params}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function FindWeddingPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; year?: string }>
}) {
  const { name = '', year = '' } = await searchParams
  const hasQuery = name.trim() !== '' || year.trim() !== ''
  const results = hasQuery ? await searchWeddings(name.trim(), year.trim()) : []

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear + i)

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#fdfaf6]">
        {/* Hero */}
        <div className="bg-[#3b2f2f] py-14 px-6 text-center">
          <h1 className="font-serif text-4xl font-bold text-white mb-2">Find a Wedding</h1>
          <p className="text-[#e8dcc8] text-base max-w-md mx-auto">
            Search for a couple&apos;s wedding website by name or year.
          </p>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

          {/* Search form */}
          <form method="GET" className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              name="name"
              defaultValue={name}
              placeholder="Search by name"
              className="flex-1 rounded-xl border border-[#e8dcc8] bg-white px-4 py-3 text-base sm:text-sm text-[#3b2f2f] placeholder-[#8a6a4a] focus:border-[#d4af6a] focus:outline-none"
            />
            <select
              name="year"
              defaultValue={year}
              className="rounded-xl border border-[#e8dcc8] bg-white px-4 py-3 text-base sm:text-sm text-[#3b2f2f] focus:border-[#d4af6a] focus:outline-none"
            >
              <option value="">Any year</option>
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-[#3b2f2f] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5c4033] transition whitespace-nowrap"
            >
              Search
            </button>
          </form>

          {/* Results */}
          {hasQuery && (
            <div>
              {results.length === 0 ? (
                <div className="text-center py-12">
                  <p className="font-serif text-xl text-[#3b2f2f] mb-2">No weddings found</p>
                  <p className="text-sm text-[#8a6a4a]">Try a different name or year, or check the spelling.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#8a6a4a] mb-4">
                    {results.length} {results.length === 1 ? 'wedding' : 'weddings'} found
                  </p>
                  <ul className="space-y-3">
                    {results.map(r => (
                      <li key={r.slug}>
                        <Link
                          href={`/wedding/${r.slug}`}
                          className="block rounded-xl border border-[#e8dcc8] bg-white px-6 py-5 hover:border-[#d4af6a] hover:shadow-sm transition group"
                        >
                          <p className="font-serif text-xl font-bold text-[#3b2f2f] group-hover:text-[#d4af6a] transition">
                            {r.partnerTwoName} &amp; {r.partnerOneName}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#8a6a4a]">
                            {r.weddingDate && <span>{formatShortDate(r.weddingDate)}</span>}
                            {r.venueCity && r.venueState && (
                              <span>{r.venueCity}, {r.venueState}</span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Empty state before search */}
          {!hasQuery && (
            <div className="text-center py-8 text-[#8a6a4a]">
              <p className="text-sm">Enter a name above to find a couple&apos;s wedding site.</p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
