import { useAuth } from '@/core/auth/AuthContext'

export default function CoupleDashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-gold-light bg-white px-6 py-4 flex items-center justify-between">
        <span className="font-serif text-xl font-bold text-brown">AltarWed</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-brown-light">{user?.name}</span>
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
          Welcome back, {user?.name?.split(' ')[0]} 🕊️
        </h2>
        <p className="text-brown-light mb-8">Your wedding planning dashboard</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="Guest List" description="Manage guests and track RSVPs" href="#" />
          <DashboardCard title="Ceremony Builder" description="Scripture, vows, and order of service" href="#" />
          <DashboardCard title="Find Vendors" description="Browse faith-aligned vendors near you" href="#" />
          <DashboardCard title="Wedding Checklist" description="Stay on track with every detail" href="#" />
          <DashboardCard title="Budget Tracker" description="Plan and track wedding spending" href="#" />
          <DashboardCard title="Subscription" description="Manage your Covenant Plan" href="#" />
        </div>
      </main>
    </div>
  )
}

function DashboardCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-gold-light bg-white p-6 hover:border-gold hover:shadow-sm transition"
    >
      <h3 className="font-serif text-lg font-semibold text-brown mb-1">{title}</h3>
      <p className="text-sm text-brown-light">{description}</p>
    </a>
  )
}
