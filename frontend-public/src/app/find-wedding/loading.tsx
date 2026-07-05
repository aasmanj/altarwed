import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { Skeleton, SkeletonRegion } from '@/components/Skeleton'

// Route-level loading UI for /find-wedding (issue #297). Static hero renders
// immediately; the search form and result list get shape-matched skeletons so
// the server-rendered results land without a layout jump.
export default function FindWeddingLoading() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#fdfaf6]">
        <div className="bg-[#3b2f2f] py-14 px-6 text-center">
          <h1 className="font-serif text-4xl font-bold text-white mb-2">Find a Wedding</h1>
          <p className="text-[#e8dcc8] text-base max-w-md mx-auto">
            Search for a couple&apos;s wedding website by name or year.
          </p>
        </div>

        <SkeletonRegion label="Loading wedding search" className="max-w-2xl mx-auto px-6 py-10 space-y-8">
          {/* Search form: input, year select, button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 w-full sm:w-32 rounded-xl" />
            <Skeleton className="h-12 w-full sm:w-28 rounded-xl" />
          </div>

          {/* Result rows, same shell as the real result cards */}
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="rounded-xl border border-[#e8dcc8] bg-white px-6 py-5">
                <Skeleton className="h-6 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </SkeletonRegion>
      </main>
      <SiteFooter />
    </>
  )
}
