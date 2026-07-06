import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { Skeleton, SkeletonRegion } from '@/components/Skeleton'

// Route-level loading UI for /vendors/[id] (issue #297). Mirrors
// VendorPageClient's layout: back link, logo + heading block, photo banner,
// and the About card, so the real profile lands without a layout jump.
export default function VendorDetailLoading() {
  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
      <SiteHeader />
      <SkeletonRegion label="Loading vendor profile" className="max-w-3xl mx-auto px-6 py-12">
        {/* Back link */}
        <Skeleton className="h-5 w-24 mb-8" />

        {/* Logo + name header */}
        <div className="flex items-start gap-6 mb-8">
          <Skeleton className="h-20 w-20 rounded-full shrink-0" />
          <div className="flex-1 pt-1">
            <Skeleton className="h-8 w-2/3 mb-2" />
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-4 w-40 mb-3" />
            <div className="flex gap-2 flex-wrap">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>

        {/* Portfolio photo banner */}
        <div className="-mx-6 mb-8">
          <Skeleton className="h-52 sm:h-64 w-full rounded-none" />
        </div>

        {/* About card */}
        <div className="mb-8 rounded-2xl border border-[#e8dcc8] bg-white p-6">
          <Skeleton className="h-6 w-24 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </SkeletonRegion>
      <SiteFooter />
    </div>
  )
}
