import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { Skeleton, SkeletonRegion } from '@/components/Skeleton'

// Route-level loading UI for /blog (issue #297). Static hero copy renders
// immediately; the article grid gets card-shaped skeletons matching the real
// post cards (cover image block + title + excerpt + byline) to avoid a layout
// jump when posts land.
export default function BlogLoading() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f5ede0] border border-[#d4af6a]/30 text-[#a07840] text-xs font-semibold uppercase tracking-widest mb-6">
              <span>✦</span> Faith-Based Planning
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#3b2f2f] mb-4">
              Christian Wedding Planning Blog
            </h1>
            <p className="text-[#6b5344] text-lg max-w-xl mx-auto">
              Scripture for your ceremony, vow guides, denomination-specific planning tips, and more. Written for couples who want their wedding to honor God.
            </p>
          </div>
        </section>

        <SkeletonRegion label="Loading articles" className="max-w-4xl mx-auto px-6 pb-24">
          <div className="grid sm:grid-cols-2 gap-8">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#e8dcc8] shadow-sm overflow-hidden"
              >
                <Skeleton className="h-48 w-full rounded-none" />
                <div className="p-6">
                  <Skeleton className="h-5 w-5/6 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SkeletonRegion>
      </main>
      <SiteFooter />
    </>
  )
}
