import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useWeddingWebsite, type WeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import OnboardingWizard from '@/features/couple/onboarding/OnboardingWizard'
import TipCallout from '@/components/TipCallout'
import { TIPS } from '@/lib/tips'
import AtAGlanceCard from '@/features/couple/AtAGlanceCard'

// Emails allowed to see the founder-metrics link in the dashboard header.
// Authorization is enforced server-side via ADMIN_EMAILS env var; this list
// is purely a UX gate so non-admins don't see a link that 403s. Keep in sync
// with the backend list when adding new founders.
const ADMIN_EMAILS = ['aasmanj@gmail.com']

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
          {/* Founder-only link to the metrics dashboard. The backend enforces
              authorization via ADMIN_EMAILS env var; this client-side gate just
              hides the link from regular couples so it doesn't clutter their UI. */}
          {user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()) && (
            <Link
              to="/admin/metrics"
              className="shrink-0 text-xs font-medium text-gold hover:text-brown transition py-2 px-2 rounded-lg hover:bg-ivory"
              title="Platform-wide founder metrics"
            >
              Metrics
            </Link>
          )}
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

        {/* Tiles are grouped into a phased journey instead of a flat 14-card grid.
            Numbered headings imply order without forcing a wizard; couples scan
            top-to-bottom and naturally land on the right section. The unnumbered
            "Explore" group is for ambient features (vendor directory) that aren't
            on the critical path. */}
        <PhaseSection number={1} title="Build the basics" description="Get the foundation in place so guests have something to RSVP to.">
          <DashboardCard title="My Wedding Website" description="Build and share your public wedding page" href="/dashboard/website/editor" live />
          <DashboardCard title="Wedding Checklist" description="Faith-first planning, step by step" href="/dashboard/checklist" live />
          <DashboardCard title="Guest List" description="Manage guests and track RSVPs" href="/dashboard/guests" live />
          <DashboardCard title="Wedding Party" description="Add your party members and officiant" href="/dashboard/wedding-party" live />
          <RegistryCard website={website} />
        </PhaseSection>

        <PhaseSection number={2} title="Tell your guests" description="Send save-the-dates and invitations. Digital is free; printed postcards go out via Lob.">
          <DashboardCard title="Communications" description="Save-the-dates, RSVP invitations, and printed postcards in one place" href="/dashboard/communications" live />
        </PhaseSection>

        <PhaseSection number={3} title="Plan the day" description="The logistics that come together as the date approaches.">
          <DashboardCard title="Budget Tracker" description="Plan and track wedding spending" href="/dashboard/budget" live />
          <DashboardCard title="Seating Chart" description="Drag and drop guest table assignments" href="/dashboard/seating" live />
          <DashboardCard title="Wedding Photos" description="Upload and share photos with guests" href="/dashboard/photos" live />
        </PhaseSection>

        <PhaseSection
          number={4}
          title="Plan the ceremony"
          description="Make this part of the day feel personal. Pick verses, write your vows, and shape the order of service."
        >
          <DashboardCard title="Ceremony Builder" description="Plan your order of service with scripture, vows, and music" href="/dashboard/ceremony" live />
          <DashboardCard title="Scripture Builder" description="Browse wedding verses and pin one to your site" href="/dashboard/scripture" live />
          <DashboardCard title="Vow Builder" description="Write and save your vows, just for the two of you" href="/dashboard/vows" live />
          <DashboardCard title="Ceremony Program" description="Print a one-page program for guests" href="/dashboard/ceremony/program" live />
        </PhaseSection>

        <PhaseSection title="Explore" description="Optional, browse anytime.">
          <DashboardCard title="Find Vendors" description="Browse faith-aligned vendors near you" href="https://www.altarwed.com/vendors" external live />
          <DashboardCard title="Resources" description="Christian marriage books and registry partners we recommend" href="https://www.altarwed.com/resources" external live />
          <DashboardCard title="Blog" description="Wedding scripture, vows, ceremony guides, and planning tips" href="https://www.altarwed.com/blog" external live />
        </PhaseSection>
      </main>
    </div>
  )
}

// Groups a set of tiles under a numbered, captioned heading. Numbering implies
// order (build basics first, then announce, then plan, then ceremony) without
// hard-gating couples to a wizard. The number chip is gold-on-cream so it reads
// as a marker, not a "step you have not completed yet" warning.
function PhaseSection({ number, title, description, children }: {
  number?: number
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8 last:mb-0">
      <div className="mb-3 flex items-center gap-3">
        {number != null && (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gold/15 text-gold font-serif text-sm font-semibold shrink-0">
            {number}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-serif text-xl font-bold text-brown leading-tight">{title}</h3>
          <p className="text-sm text-brown-light leading-snug">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  )
}

// Dedicated registry card that shows how many of 3 registry slots have been filled.
// Placed prominently so couples configure it before sending invitations — the RSVP
// confirmation page links to the registry, and an empty one creates a dead end.
function RegistryCard({ website }: { website: WeddingWebsite | undefined | null }) {
  const filled = [website?.registryUrl1, website?.registryUrl2, website?.registryUrl3].filter(Boolean).length
  const isComplete = filled === 3
  const isEmpty = filled === 0

  return (
    <Link
      to="/dashboard/website?tab=registry"
      className="block rounded-xl border border-gold bg-white p-6 transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-serif text-lg font-semibold text-brown">Registry</h3>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
          isComplete
            ? 'bg-emerald-100 text-emerald-700'
            : isEmpty
            ? 'bg-amber-100 text-amber-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {filled} of 3 added
        </span>
      </div>
      <p className="text-sm text-brown-light">Link your Amazon, Target, or Zola registries</p>
      {isEmpty && (
        <p className="mt-2 text-xs text-amber-700 font-medium">
          Set this up before sending invites — guests expect a registry link after RSVPing.
        </p>
      )}
    </Link>
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
