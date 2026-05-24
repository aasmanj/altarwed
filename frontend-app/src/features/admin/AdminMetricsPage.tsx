import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiClient } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'

interface DailyCount {
  date: string
  count: number
}

interface MetricsSnapshot {
  totalCouples: number
  couplesLast7Days: number
  couplesLast30Days: number
  totalWebsites: number
  publishedWebsites: number
  totalGuests: number
  totalRsvpsAttending: number
  totalRsvpsDeclining: number
  totalVendors: number
  activeVendors: number
  verifiedVendors: number
  totalBlogPosts: number
  totalBudgetItems: number
  totalCeremonySections: number
  totalPlanningTasks: number
  totalWeddingPhotos: number
  coupleSignupsLast30Days: DailyCount[]
}

export default function AdminMetricsPage() {
  const { user, logout } = useAuth()
  const { data, isLoading, error } = useQuery<MetricsSnapshot>({
    queryKey: ['admin-metrics'],
    queryFn: () => apiClient.get('/api/v1/admin/metrics').then(r => r.data),
    refetchInterval: 60_000,
  })

  const forbidden = (error as { response?: { status?: number } } | null)?.response?.status === 403

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-gold-light bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="font-serif text-xl font-bold text-brown">AltarWed</Link>
          <span className="text-xs uppercase tracking-wider text-brown-light">Founder metrics</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-brown-light">{user?.email}</span>
          <button onClick={logout} className="text-sm font-medium text-brown-light hover:text-brown">Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {isLoading && <p className="text-brown-light">Loading metrics…</p>}
        {forbidden && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
            <h2 className="font-serif text-lg font-semibold mb-1">Not authorized</h2>
            <p className="text-sm">Your account ({user?.email}) is not an admin. Add it to ADMIN_EMAILS env var.</p>
          </div>
        )}
        {error && !forbidden && <p className="text-rose-700">Failed to load metrics.</p>}

        {data && (
          <>
            <h2 className="font-serif text-2xl font-bold text-brown mb-1">Platform metrics</h2>
            <p className="text-sm text-brown-light mb-8">Aggregate counts only. No personal data shown. Refreshes every 60s.</p>

            <Section title="Growth">
              <Stat label="Total couples" value={data.totalCouples} accent />
              <Stat label="New (last 7 days)" value={data.couplesLast7Days} />
              <Stat label="New (last 30 days)" value={data.couplesLast30Days} />
            </Section>

            <Section title="Wedding websites">
              <Stat label="Created" value={data.totalWebsites} />
              <Stat label="Published (public)" value={data.publishedWebsites} accent />
              <Stat label="Photos uploaded" value={data.totalWeddingPhotos} />
            </Section>

            <Section title="Guest engagement">
              <Stat label="Guests invited" value={data.totalGuests} />
              <Stat label="RSVPs: attending" value={data.totalRsvpsAttending} accent />
              <Stat label="RSVPs: declining" value={data.totalRsvpsDeclining} />
            </Section>

            <Section title="Vendors">
              <Stat label="Total listings" value={data.totalVendors} />
              <Stat label="Active" value={data.activeVendors} />
              <Stat label="Verified" value={data.verifiedVendors} />
            </Section>

            <Section title="Platform usage">
              <Stat label="Budget items" value={data.totalBudgetItems} />
              <Stat label="Ceremony sections" value={data.totalCeremonySections} />
              <Stat label="Planning tasks" value={data.totalPlanningTasks} />
              <Stat label="Blog posts" value={data.totalBlogPosts} />
            </Section>

            <div className="mt-10">
              <h3 className="font-serif text-lg font-semibold text-brown mb-3">Couple signups, last 30 days</h3>
              <Sparkline data={data.coupleSignupsLast30Days} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="font-serif text-lg font-semibold text-brown mb-3">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-5 ${accent ? 'border-gold' : 'border-gold-light'}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-brown-light">{label}</div>
      <div className="mt-1 font-serif text-3xl font-bold text-brown">{value.toLocaleString()}</div>
    </div>
  )
}

function Sparkline({ data }: { data: DailyCount[] }) {
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div className="rounded-xl border border-gold-light bg-white p-5">
      <div className="flex items-end gap-1 h-32">
        {data.map(d => (
          <div key={d.date} className="flex-1 flex flex-col justify-end" title={`${d.date}: ${d.count}`}>
            <div
              className="bg-gold rounded-t"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '4px' : '1px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-brown-light">
        <span>{data[0]?.date}</span>
        <span>Today</span>
      </div>
    </div>
  )
}
