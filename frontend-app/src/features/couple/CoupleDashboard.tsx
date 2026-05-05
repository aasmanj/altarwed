import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'

export default function CoupleDashboard() {
  const { user, logout } = useAuth()

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

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-serif text-2xl font-bold text-brown mb-2">
          Welcome back, {user?.partnerOneName && user?.partnerTwoName
            ? `${user.partnerOneName} & ${user.partnerTwoName}`
            : user?.partnerOneName ?? user?.email}
        </h2>
        <p className="text-brown-light mb-8">Your wedding planning dashboard</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="My Wedding Website" description="Build and share your public wedding page" href="/dashboard/website" live />
          <DashboardCard title="Guest List" description="Manage guests and track RSVPs" href="#" />
          <DashboardCard title="Ceremony Builder" description="Scripture, vows, and order of service" href="#" />
          <DashboardCard title="Find Vendors" description="Browse faith-aligned vendors near you" href="#" />
          <DashboardCard title="Wedding Checklist" description="Stay on track with every detail" href="#" />
          <DashboardCard title="Budget Tracker" description="Plan and track wedding spending" href="#" />
        </div>
      </main>
    </div>
  )
}

function DashboardCard({ title, description, href, live }: { title: string; description: string; href: string; live?: boolean }) {
  const cls = 'block rounded-xl border bg-white p-6 transition ' +
    (live ? 'border-gold hover:shadow-md' : 'border-gold-light opacity-60 cursor-not-allowed')

  if (live && href !== '#') {
    return (
      <Link to={href} className={cls}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-lg font-semibold text-brown">{title}</h3>
          <span className="text-xs bg-gold/10 text-gold font-medium px-2 py-0.5 rounded-full">Live</span>
        </div>
        <p className="text-sm text-brown-light">{description}</p>
      </Link>
    )
  }

  return (
    <div className={cls}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-serif text-lg font-semibold text-brown">{title}</h3>
        <span className="text-xs bg-gray-100 text-gray-400 font-medium px-2 py-0.5 rounded-full">Soon</span>
      </div>
      <p className="text-sm text-brown-light">{description}</p>
    </div>
  )
}
