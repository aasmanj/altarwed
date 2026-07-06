import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { Skeleton, SkeletonRegion } from '@/components/Skeleton'

// Route-level loading UI for /vendors (issue #297). The route is
// force-dynamic, so every filter/pagination click paid a full server round
// trip with zero feedback before this existed. The skeleton mirrors the real
// page's layout (hero, filter rows, city form, 3-column card grid) so content
// lands without a layout jump.
export default function VendorsLoading() {
  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
      <SiteHeader />

      {/* Hero copy is static on the real page, so render it for instant context. */}
      <section className="bg-[#3b2f2f] py-14 px-6 text-center">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-3">
          Faith-first wedding vendors
        </h1>
        <p className="text-[#fdfaf6]/70 text-base max-w-xl mx-auto">
          Every vendor here has been listed by a Christian business owner or works regularly with faith-based couples.
        </p>
      </section>

      <SkeletonRegion label="Loading vendors" className="max-w-5xl mx-auto px-6 py-10">
        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>

        {/* Price-tier chips */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-14 rounded-full" />
          ))}
        </div>

        {/* City search form */}
        <div className="flex gap-3 mb-8 max-w-sm">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-20" />
        </div>

        {/* Result count line */}
        <Skeleton className="h-4 w-48 mb-5" />

        {/* Vendor card grid, same shell classes as the real cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="rounded-2xl border border-[#e8dcc8] bg-white p-6">
              <div className="flex items-start justify-between gap-2 mb-3">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </SkeletonRegion>

      <SiteFooter />
    </div>
  )
}
