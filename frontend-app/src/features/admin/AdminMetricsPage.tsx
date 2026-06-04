import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiClient } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'

interface DailyCount {
  date: string
  count: number
}

interface WebsiteAdminRow {
  coupleId: string
  email: string
  groomName: string
  brideName: string
  weddingDate: string | null
  signedUpAt: string
  slug: string | null
  isPublished: boolean | null
}

interface WebsiteRoster {
  rows: WebsiteAdminRow[]
  total: number
  page: number
  size: number
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

const PAGE_SIZE = 20

export default function AdminMetricsPage() {
  const { user, logout } = useAuth()
  const [websitePage, setWebsitePage] = useState(0)

  const { data, isLoading, error } = useQuery<MetricsSnapshot>({
    queryKey: ['admin-metrics'],
    queryFn: () => apiClient.get('/api/v1/admin/metrics').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: roster } = useQuery<WebsiteRoster>({
    queryKey: ['admin-websites', websitePage],
    queryFn: () =>
      apiClient.get(`/api/v1/admin/metrics/websites?page=${websitePage}&size=${PAGE_SIZE}`).then(r => r.data),
    enabled: !!data, // only load after metrics confirm admin access
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

            {roster && (
              <div className="mt-10">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-serif text-lg font-semibold text-brown">
                    All accounts
                    <span className="ml-2 text-sm font-sans font-normal text-brown-light">
                      {roster.total.toLocaleString()} total
                    </span>
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-brown-light">
                    <span>
                      {roster.total === 0
                        ? '0 of 0'
                        : `${roster.page * PAGE_SIZE + 1}–${Math.min((roster.page + 1) * PAGE_SIZE, roster.total)} of ${roster.total.toLocaleString()}`}
                    </span>
                    <button
                      onClick={() => setWebsitePage(p => Math.max(0, p - 1))}
                      disabled={roster.page === 0}
                      className="px-3 py-1 rounded border border-gold-light hover:bg-ivory disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setWebsitePage(p => p + 1)}
                      disabled={(roster.page + 1) * PAGE_SIZE >= roster.total}
                      className="px-3 py-1 rounded border border-gold-light hover:bg-ivory disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gold-light bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gold-light bg-ivory">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-brown-light uppercase tracking-wide text-xs">Couple</th>
                        <th className="text-left px-4 py-3 font-medium text-brown-light uppercase tracking-wide text-xs">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-brown-light uppercase tracking-wide text-xs">Website</th>
                        <th className="text-left px-4 py-3 font-medium text-brown-light uppercase tracking-wide text-xs">Wedding date</th>
                        <th className="text-left px-4 py-3 font-medium text-brown-light uppercase tracking-wide text-xs">Signed up</th>
                        <th className="text-left px-4 py-3 font-medium text-brown-light uppercase tracking-wide text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-light">
                      {roster.rows.map(row => (
                        <tr key={row.coupleId} className="hover:bg-ivory/50 transition">
                          <td className="px-4 py-3 font-medium text-brown">
                            {row.groomName} &amp; {row.brideName}
                          </td>
                          <td className="px-4 py-3 text-brown-light">{row.email}</td>
                          <td className="px-4 py-3">
                            {row.slug ? (
                              <a
                                href={`https://www.altarwed.com/wedding/${row.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gold hover:underline font-mono text-xs"
                              >
                                /{row.slug}
                              </a>
                            ) : (
                              <span className="text-brown-light text-xs italic">no website yet</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-brown-light">
                            {row.weddingDate ?? <span className="italic text-xs">not set</span>}
                          </td>
                          <td className="px-4 py-3 text-brown-light text-xs">
                            {new Date(row.signedUpAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            {row.isPublished === true && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Live</span>
                            )}
                            {row.isPublished === false && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Draft</span>
                            )}
                            {row.isPublished == null && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">No site</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
