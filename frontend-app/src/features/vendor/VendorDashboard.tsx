import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useVendorProfile, useVendorStats, useVendorAnalytics } from './useVendor'
import { useVendorInquiries } from './useInquiries'
import { useVendorSubscription } from './useSubscription'
import { analyticsCardCopy } from './analyticsCard'

export default function VendorDashboard() {
  const { user, logout } = useAuth()
  const { data: vendor } = useVendorProfile()
  const { data: inquiries = [] } = useVendorInquiries()
  const { data: stats, isError: statsError } = useVendorStats()
  // Inquiry analytics are Pro-only; only fetch them once stats confirms the entitlement so we
  // never trigger a 402 for a free-tier vendor.
  const { data: analytics } = useVendorAnalytics(stats?.proAnalytics === true)
  const { data: sub } = useVendorSubscription()

  const displayName = vendor?.businessName ?? user?.email ?? ''
  const unreadCount = inquiries.filter(i => !i.isRead).length
  const analyticsCard = analyticsCardCopy(stats, analytics, {
    statsError,
    pastDue: sub?.status === 'PAST_DUE',
  })

  return (
    <div className="min-h-screen bg-[#fdfaf6]">
      <header className="border-b border-[#e8dcc8] bg-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <span className="font-serif text-xl font-bold text-[#3b2f2f] shrink-0">AltarWed</span>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <span className="text-sm text-[#8a6a4a] truncate hidden sm:block">{user?.email}</span>
          <button onClick={logout} className="shrink-0 text-sm text-[#8a6a4a] hover:text-[#3b2f2f] transition py-2 px-3 rounded-lg hover:bg-[#fdfaf6]">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">
          Welcome, {displayName}
        </h1>
        <p className="text-[#8a6a4a] text-sm mb-6">Your vendor dashboard</p>

        {vendor && !vendor.isVerified && (
          <div className="mb-6 rounded-xl border border-[#d4af6a]/50 bg-[#fdf6eb] px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-[#3b2f2f] text-sm">Your listing is not published yet</p>
              <p className="text-xs text-[#6b5344] mt-0.5">
                Subscribe to make your listing visible to couples browsing AltarWed.
              </p>
            </div>
            <Link
              to="/vendor/subscription"
              className="shrink-0 rounded-lg bg-[#3b2f2f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5c4033] transition"
            >
              Get listed
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="My Listing"
            description="Edit your business profile and category"
            href="/vendor/listing"
            live
          />
          <DashboardCard
            title="Inquiries"
            description={
              unreadCount > 0
                ? `${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`
                : 'View and respond to couple inquiries'
            }
            href="/vendor/inquiries"
            live
            badge={unreadCount > 0 ? String(unreadCount) : undefined}
          />
          <DashboardCard title="Reviews" description="See what couples are saying" href="#" comingSoon />
          {analyticsCard.upgrade ? (
            // Non-Pro: the card becomes an upgrade CTA linking to the subscription page.
            <DashboardCard
              title="Analytics"
              description={analyticsCard.description}
              href="/vendor/subscription"
              live
            />
          ) : (
            <DashboardCard
              title="Analytics"
              description={analyticsCard.description}
              href="#"
              passive
            />
          )}
          <DashboardCard
            title="Subscription"
            description={
              sub?.planTier === 'FEATURED' && sub?.status === 'ACTIVE'
                ? 'Pro plan active'
                : sub?.status === 'PAST_DUE'
                ? 'Payment past due'
                : 'Upgrade to Pro for $29/mo'
            }
            href="/vendor/subscription"
            live
            badge={sub?.status === 'PAST_DUE' ? '!' : undefined}
          />
        </div>

        <div className="mt-10 rounded-2xl border border-[#e8dcc8] bg-white p-6">
          <p className="font-serif text-lg font-semibold text-[#3b2f2f] mb-1">Your public listing</p>
          {vendor ? (
            !vendor.isVerified ? (
              <p className="text-sm text-[#8a6a4a]">
                Your listing will appear here once you{' '}
                <Link to="/vendor/subscription" className="text-[#3b2f2f] font-medium hover:underline">
                  subscribe
                </Link>
                .
              </p>
            ) : vendor.isActive ? (
              <a
                href={`https://www.altarwed.com/vendors/${vendor.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#d4af6a] hover:underline"
              >
                altarwed.com/vendors/{vendor.id} ↗
              </a>
            ) : (
              <p className="text-sm text-[#8a6a4a]">
                Your listing is paused and not public right now.{' '}
                <Link to="/vendor/listing" className="text-[#3b2f2f] font-medium hover:underline">
                  Resume it
                </Link>{' '}
                to make it visible to couples again.
              </p>
            )
          ) : (
            <p className="text-sm text-[#8a6a4a]">Complete your listing to appear in search results</p>
          )}
        </div>
      </main>
    </div>
  )
}

function DashboardCard({ title, description, href, live, comingSoon, passive, badge }: {
  title: string
  description: string
  href: string
  live?: boolean
  comingSoon?: boolean
  // passive: a non-clickable card that still shows real data (e.g. Analytics).
  // Rendered at full opacity so live numbers never look like a broken/disabled
  // link, distinct from comingSoon which is intentionally greyed out.
  passive?: boolean
  badge?: string
}) {
  const isLive = live && href !== '#'
  const cardCls = 'block rounded-xl border bg-white p-6 transition ' +
    (isLive
      ? 'border-[#d4af6a] hover:shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a] focus-visible:ring-offset-2'
      : passive
        ? 'border-[#e8dcc8] cursor-default'
        : 'border-[#e8dcc8] opacity-60 cursor-not-allowed')

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-serif text-lg font-semibold text-[#3b2f2f]">{title}</h3>
        {comingSoon && (
          <span className="shrink-0 text-xs font-medium text-[#8a6a4a] bg-[#f5ede0] px-2 py-0.5 rounded-full">
            Soon
          </span>
        )}
        {badge && (
          <span className="shrink-0 text-xs font-bold text-white bg-[#d4af6a] px-2 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-[#8a6a4a]">{description}</p>
    </>
  )

  if (isLive) {
    return <Link to={href} className={cardCls}>{inner}</Link>
  }

  return <div className={cardCls}>{inner}</div>
}
