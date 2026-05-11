import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import OnboardingWizard from '@/features/couple/onboarding/OnboardingWizard'

export default function CoupleDashboard() {
  const { user, logout } = useAuth()
  const coupleId = user?.id ?? ''
  const { data: website, isLoading: siteLoading, error: siteError } = useWeddingWebsite(coupleId)
  const isNotFound = (siteError as { response?: { status?: number } } | null)?.response?.status === 404

  // New user — no website yet. Show the onboarding wizard instead of the dashboard.
  if (!siteLoading && (isNotFound || (!siteError && !website && !siteLoading))) {
    if (isNotFound) return <OnboardingWizard />
  }

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-gold-light bg-white px-6 py-4 flex items-center justify-between">
        <span className="font-serif text-xl font-bold text-brown">AltarWed</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-brown-light">{user?.partnerOneName ?? user?.email}</span>
          <button
            onClick={logout}
            className="text-sm text-brown-light hover:text-brown transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Help banner */}
      <div className="bg-gold/10 border-b border-gold-light px-6 py-2.5 text-center text-sm text-brown">
        Questions or found a bug?{' '}
        <a href="mailto:hello@altarwed.com" className="font-medium text-gold hover:underline">
          Email hello@altarwed.com
        </a>
        {' '}— Jordan responds personally.
      </div>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-serif text-2xl font-bold text-brown mb-2">
          Welcome back, {user?.partnerOneName && user?.partnerTwoName
            ? `${user.partnerOneName} & ${user.partnerTwoName}`
            : user?.partnerOneName ?? user?.email}
        </h2>
        <p className="text-brown-light mb-8">Your wedding planning dashboard</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="My Wedding Website" description="Build and share your public wedding page" href="/dashboard/website" live />
          <DashboardCard title="Guest List" description="Manage guests and track RSVPs" href="/dashboard/guests" live />
          <DashboardCard title="Wedding Checklist" description="Faith-first planning, step by step" href="/dashboard/checklist" live />
          <DashboardCard title="Wedding Party" description="Add your party members and officiant" href="/dashboard/wedding-party" live />
          <DashboardCard title="Find Vendors" description="Browse faith-aligned vendors near you" href="https://www.altarwed.com/vendors" external live />
          <DashboardCard title="Budget Tracker" description="Plan and track wedding spending" href="/dashboard/budget" live />
          <DashboardCard title="Save the Dates" description="Design and send save-the-date emails" href="/dashboard/save-the-date" live />
          <DashboardCard title="Wedding Photos" description="Upload and share photos with guests" href="/dashboard/photos" live />
          <DashboardCard title="Seating Chart" description="Drag-and-drop guest table assignments" href="/dashboard/seating" live />
          <DashboardCard title="Scripture Builder" description="Browse wedding verses and pin one to your site" href="/dashboard/scripture" live />
        </div>
      </main>
    </div>
  )
}

function DashboardCard({ title, description, href, live, external }: {
  title: string; description: string; href: string; live?: boolean; external?: boolean
}) {
  const cls = 'block rounded-xl border bg-white p-6 transition ' +
    (live ? 'border-gold hover:shadow-md' : 'border-gold-light opacity-60 cursor-not-allowed')

  const badge = <span className="text-xs bg-gold/10 text-gold font-medium px-2 py-0.5 rounded-full">Live</span>
  const content = (
    <>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-serif text-lg font-semibold text-brown">{title}</h3>
        {live ? badge : <span className="text-xs bg-gray-100 text-gray-400 font-medium px-2 py-0.5 rounded-full">Soon</span>}
      </div>
      <p className="text-sm text-brown-light">{description}</p>
    </>
  )

  if (live && external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{content}</a>
  }
  if (live && href !== '#') {
    return <Link to={href} className={cls}>{content}</Link>
  }
  return <div className={cls}>{content}</div>
}
