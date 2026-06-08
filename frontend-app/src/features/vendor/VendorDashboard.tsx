import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useVendorProfile, useVendorStats } from './useVendor'
import { useVendorInquiries } from './useInquiries'
import { useVendorSubscription } from './useSubscription'

export default function VendorDashboard() {
  const { user, logout } = useAuth()
  const { data: vendor } = useVendorProfile()
  const { data: inquiries = [] } = useVendorInquiries()
  const { data: stats } = useVendorStats()
  const { data: sub } = useVendorSubscription()

  const displayName = vendor?.businessName ?? user?.email ?? ''
  const unreadCount = inquiries.filter(i => !i.isRead).length

  return (
    <div className="min-h-screen bg-[#fdfaf6]">
      <header className="border-b border-[#e8dcc8] bg-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <span className="font-serif text-xl font-bold text-[#3b2f2f] shrink-0">AltarWed</span>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <span className="text-sm text-[#a08060] truncate hidden sm:block">{user?.email}</span>
          <button onClick={logout} className="shrink-0 text-sm text-[#a08060] hover:text-[#3b2f2f] transition py-2 px-3 rounded-lg hover:bg-[#fdfaf6]">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">
          Welcome, {displayName}
        </h1>
        <p className="text-[#a08060] text-sm mb-8">Your vendor dashboard</p>

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
          <DashboardCard
            title="Analytics"
            description={
              stats
                ? `${stats.viewCount} profile views · ${stats.inquiryCount} total inquiries`
                : 'Profile views and inquiry trends'
            }
            href="#"
            live={!!stats}
          />
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
            <a
              href={`https://www.altarwed.com/vendors/${vendor.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#d4af6a] hover:underline"
            >
              altarwed.com/vendors/{vendor.id} ↗
            </a>
          ) : (
            <p className="text-sm text-[#a08060]">Complete your listing to appear in search results</p>
          )}
        </div>
      </main>
    </div>
  )
}

function DashboardCard({ title, description, href, live, comingSoon, badge }: {
  title: string
  description: string
  href: string
  live?: boolean
  comingSoon?: boolean
  badge?: string
}) {
  const isLive = live && href !== '#'
  const cardCls = 'block rounded-xl border bg-white p-6 transition ' +
    (isLive
      ? 'border-[#d4af6a] hover:shadow-md cursor-pointer'
      : 'border-[#e8dcc8] opacity-60 cursor-not-allowed')

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-serif text-lg font-semibold text-[#3b2f2f]">{title}</h3>
        {comingSoon && (
          <span className="shrink-0 text-xs font-medium text-[#a08060] bg-[#f5ede0] px-2 py-0.5 rounded-full">
            Soon
          </span>
        )}
        {badge && (
          <span className="shrink-0 text-xs font-bold text-white bg-[#d4af6a] px-2 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-[#a08060]">{description}</p>
    </>
  )

  if (isLive) {
    return <Link to={href} className={cardCls}>{inner}</Link>
  }

  return <div className={cardCls}>{inner}</div>
}
