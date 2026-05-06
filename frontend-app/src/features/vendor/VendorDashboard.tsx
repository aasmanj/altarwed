import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useVendorProfile } from './useVendor'

export default function VendorDashboard() {
  const { user, logout } = useAuth()
  const { data: vendor } = useVendorProfile()

  const displayName = vendor?.businessName ?? user?.email ?? ''

  return (
    <div className="min-h-screen bg-[#fdfaf6]">
      <header className="border-b border-[#e8dcc8] bg-white px-6 py-4 flex items-center justify-between">
        <span className="font-serif text-xl font-bold text-[#3b2f2f]">AltarWed</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#a08060]">{user?.email}</span>
          <button onClick={logout} className="text-sm text-[#a08060] hover:text-[#3b2f2f] transition">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-1">
          Welcome, {displayName}
        </h2>
        <p className="text-[#a08060] text-sm mb-8">Your vendor dashboard</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="My Listing"
            description="Edit your business profile and category"
            href="/vendor/listing"
            live
          />
          <DashboardCard title="Inquiries" description="View and respond to couple inquiries" href="#" />
          <DashboardCard title="Reviews" description="See what couples are saying" href="#" />
          <DashboardCard title="Analytics" description="Profile views and inquiry trends" href="#" />
          <DashboardCard title="Subscription" description="Manage your vendor plan" href="#" />
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

function DashboardCard({ title, description, href, live }: {
  title: string; description: string; href: string; live?: boolean
}) {
  const cls = 'block rounded-xl border bg-white p-6 transition ' +
    (live && href !== '#'
      ? 'border-[#d4af6a] hover:shadow-md cursor-pointer'
      : 'border-[#e8dcc8] opacity-60 cursor-not-allowed')

  if (live && href !== '#') {
    return (
      <Link to={href} className={cls}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-lg font-semibold text-[#3b2f2f]">{title}</h3>
          <span className="text-xs bg-[#d4af6a]/10 text-[#d4af6a] font-medium px-2 py-0.5 rounded-full">Live</span>
        </div>
        <p className="text-sm text-[#a08060]">{description}</p>
      </Link>
    )
  }

  return (
    <div className={cls}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-serif text-lg font-semibold text-[#3b2f2f]">{title}</h3>
        <span className="text-xs bg-gray-100 text-gray-400 font-medium px-2 py-0.5 rounded-full">Soon</span>
      </div>
      <p className="text-sm text-[#a08060]">{description}</p>
    </div>
  )
}
