import { useState } from 'react'
import { Link2, Share2 } from 'lucide-react'
import { useGuests } from '@/features/couple/guests/useGuests'
import { computeGuestStats } from '@/features/couple/guests/guestStats'
import NextStepCard from '@/features/couple/NextStepCard'
import { useBudget } from '@/features/couple/budget/useBudget'
import { usePlanningTasks } from '@/features/couple/checklist/usePlanningTasks'
import ShareModal from '@/features/couple/website/ShareModal'
import type { WeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { daysUntilDate, formatShortDate, dueDateBefore } from '@/lib/date'

interface Props {
  coupleId: string
  website: WeddingWebsite | undefined
}

export default function AtAGlanceCard({ coupleId, website }: Props) {
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const { data: guests } = useGuests(coupleId)
  const { data: budget } = useBudget(coupleId)
  const { data: tasks } = usePlanningTasks(coupleId)

  const days = website?.weddingDate ? daysUntilDate(website.weddingDate) : null
  const dateLabel = website?.weddingDate ? formatShortDate(website.weddingDate) : 'Date not set'

  // Shared with GuestListPage's stat tiles/analytics panel (guestStats.ts) so the two
  // pages can't silently drift apart again the way the RSVP headcount and response-rate
  // denominator both did.
  const guestStats = computeGuestStats(guests ?? [])
  const { attending, total: totalGuests, declining, pending, responseRate } = guestStats

  const spent = budget?.totalActual ?? 0
  const goal = website?.goalBudget ?? 0
  const budgetPct = goal > 0 ? Math.min(100, Math.round((spent / goal) * 100)) : 0
  const overBudget = goal > 0 && spent > goal

  const totalTasks = tasks?.length ?? 0
  const doneTasks = tasks?.filter(t => t.isCompleted).length ?? 0
  const checklistPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const overdueTasks = website?.weddingDate
    ? (tasks?.filter(t =>
        !t.isCompleted && t.dueMonthsBefore != null &&
        dueDateBefore(website.weddingDate!, t.dueMonthsBefore).getTime() < Date.now(),
      ).length ?? 0)
    : 0
  const checklistSub =
    totalTasks === 0 ? 'Getting started'
      : checklistPct === 100 ? 'All done!'
      : overdueTasks > 0 ? `${overdueTasks} need${overdueTasks === 1 ? 's' : ''} attention`
      : 'On track'

  const publicUrl = website?.slug ? `https://www.altarwed.com/wedding/${website.slug}` : null
  const copyLink = async () => {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-8 rounded-2xl border border-gold-light bg-gradient-to-br from-white to-ivory p-6 shadow-sm">
      {website?.isPublished && publicUrl && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden="true" />
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 text-sm font-medium text-green-800 hover:underline truncate"
            aria-label={`View live wedding website at ${publicUrl}`}
          >
            {publicUrl.replace('https://', '')}
          </a>
          <button
            onClick={copyLink}
            aria-label="Copy wedding website link"
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
          >
            <Link2 className="w-3 h-3" />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            onClick={() => setShareOpen(true)}
            aria-label="Share wedding website"
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 hover:underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 rounded"
          >
            <Share2 className="w-3 h-3" />
            Share
          </button>
        </div>
      )}
      {!website?.isPublished && website?.slug && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <span className="text-sm text-yellow-800">Your wedding website is a draft. Publish it so guests can visit.</span>
          <a
            href="/dashboard/website/editor"
            className="shrink-0 rounded-lg bg-[#d4af6a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#c49d55] transition"
          >
            Publish →
          </a>
        </div>
      )}
      {/* Post-publish "what's next" nudge. Only after publishing, since the draft banner
          above already guides couples to publish; the pre-website wizard covers earlier
          stages. Driven by the guests/stats already loaded here, so it adds no API calls. */}
      {website?.isPublished && guests !== undefined && (
        <NextStepCard coupleId={coupleId} guests={guests} stats={guestStats} />
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Wedding day"
          primary={days === null ? 'Not set' : days > 0 ? `${days}` : days === 0 ? 'Today!' : `${Math.abs(days)}`}
          suffix={days === null ? '' : days > 0 ? 'days to go' : days === 0 ? '' : 'days ago'}
          sub={dateLabel}
        />
        <Metric
          label="RSVPs"
          primary={`${attending}`}
          suffix={`of ${totalGuests} attending`}
          sub={`${declining} declined · ${pending} pending · ${responseRate}% responded`}
        />
        <Metric
          label="Budget"
          primary={goal > 0 ? `$${spent.toLocaleString()}` : 'Not set'}
          suffix={goal > 0 ? `of $${goal.toLocaleString()}` : 'No goal set'}
          sub={goal > 0 ? (overBudget ? `Over by $${(spent - goal).toLocaleString()}` : `${budgetPct}% of goal`) : 'Set a goal in Budget'}
          bar={goal > 0 ? { pct: budgetPct, color: overBudget ? 'bg-rose-500' : 'bg-gold' } : undefined}
        />
        <Metric
          label="Checklist"
          primary={`${checklistPct}%`}
          suffix={`${doneTasks} of ${totalTasks} done`}
          sub={checklistSub}
          bar={totalTasks > 0 ? { pct: checklistPct, color: 'bg-emerald-500' } : undefined}
        />
      </div>
      {website?.slug && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          slug={website.slug}
          coupleNames={`${website.partnerOneName} & ${website.partnerTwoName}`}
        />
      )}
    </div>
  )
}

function Metric({ label, primary, suffix, sub, bar }: {
  label: string
  primary: string
  suffix: string
  sub: string
  bar?: { pct: number; color: string }
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-brown-light">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-serif text-3xl font-bold text-brown">{primary}</span>
        {suffix && <span className="text-sm text-brown-light">{suffix}</span>}
      </div>
      {bar && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ivory">
          <div className={`h-full ${bar.color} transition-all`} style={{ width: `${bar.pct}%` }} />
        </div>
      )}
      <div className="mt-1 text-xs text-brown-light break-words">{sub}</div>
    </div>
  )
}
