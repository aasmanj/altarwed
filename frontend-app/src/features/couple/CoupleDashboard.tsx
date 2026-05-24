import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import OnboardingWizard from '@/features/couple/onboarding/OnboardingWizard'
import TipCallout from '@/components/TipCallout'
import { TIPS } from '@/lib/tips'
import AtAGlanceCard from '@/features/couple/AtAGlanceCard'

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
      <header className="border-b border-gold-light bg-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <span className="font-serif text-xl font-bold text-brown shrink-0">AltarWed</span>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <span className="text-sm text-brown-light truncate hidden sm:block">{user?.partnerOneName ?? user?.email}</span>
          <button
            onClick={logout}
            className="shrink-0 text-sm font-medium text-brown-light hover:text-brown transition py-2 px-3 rounded-lg hover:bg-ivory"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Help banner */}
      <div className="bg-gold/10 border-b border-gold-light px-4 sm:px-6 py-2.5 text-center text-sm text-brown">
        Questions or found a bug?{' '}
        <a href="mailto:hello@altarwed.com" className="font-medium text-gold hover:underline">
          Email hello@altarwed.com
        </a>

      </div>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        <h2 className="font-serif text-2xl font-bold text-brown mb-2">
          Welcome back, {user?.partnerOneName && user?.partnerTwoName
            ? `${user.partnerOneName} & ${user.partnerTwoName}`
            : user?.partnerOneName ?? user?.email}
        </h2>
        <p className="text-brown-light mb-6">Your wedding planning dashboard</p>

        <AtAGlanceCard coupleId={coupleId} website={website} />

        <div className="mb-6">
          <TipCallout tip={TIPS.dashboardWelcome} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="My Wedding Website" description="Build and share your public wedding page" href="/dashboard/website/editor" live />
          <DashboardCard title="Guest List" description="Manage guests and track RSVPs" href="/dashboard/guests" live />
          <DashboardCard title="Wedding Checklist" description="Faith-first planning, step by step" href="/dashboard/checklist" live />
          <DashboardCard title="Wedding Party" description="Add your party members and officiant" href="/dashboard/wedding-party" live />
          <DashboardCard title="Find Vendors" description="Browse faith-aligned vendors near you" href="https://www.altarwed.com/vendors" external live />
          <DashboardCard title="Budget Tracker" description="Plan and track wedding spending" href="/dashboard/budget" live />
          <DashboardCard title="Save the Dates" description="Design and send save-the-date emails" href="/dashboard/save-the-date" live />
          <DashboardCard title="Communications" description="Send printed save-the-dates and invitations via Lob" href="/dashboard/communications" live />
          <DashboardCard title="Wedding Photos" description="Upload and share photos with guests" href="/dashboard/photos" live />
          <DashboardCard title="Seating Chart" description="Drag-and-drop guest table assignments" href="/dashboard/seating" live />
          <DashboardCard title="Scripture Builder" description="Browse wedding verses and pin one to your site" href="/dashboard/scripture" live />
          <DashboardCard title="Vow Builder" description="Write and save your wedding vows — just for the two of you" href="/dashboard/vows" live />
          <DashboardCard title="Ceremony Builder" description="Plan your order of service with scripture, vows, and music" href="/dashboard/ceremony" live />
        </div>
      </main>
    </div>
  )
}

function DashboardCard({ title, description, href, live, external, showEditorLink }: {
  title: string; description: string; href: string; live?: boolean; external?: boolean; showEditorLink?: boolean
}) {
  const cls = 'block rounded-xl border bg-white p-6 transition ' +
    (live ? 'border-gold hover:shadow-md' : 'border-gold-light opacity-60 cursor-not-allowed')

  const content = (
    <>
      <div className="mb-1">
        <h3 className="font-serif text-lg font-semibold text-brown">{title}</h3>
      </div>
      <p className="text-sm text-brown-light">{description}</p>
      {showEditorLink && (
        <div className="mt-3">
          <Link
            to="/dashboard/website/editor"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
          >
            Edit in side-by-side mode →
          </Link>
        </div>
      )}
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
