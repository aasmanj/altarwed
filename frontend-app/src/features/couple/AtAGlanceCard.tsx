import { useGuests } from '@/features/couple/guests/useGuests'
import { useBudget } from '@/features/couple/budget/useBudget'
import { usePlanningTasks } from '@/features/couple/checklist/usePlanningTasks'
import type { WeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { daysUntilDate, formatShortDate, dueDateBefore } from '@/lib/date'

interface Props {
  coupleId: string
  website: WeddingWebsite | undefined
}

export default function AtAGlanceCard({ coupleId, website }: Props) {
  const { data: guests } = useGuests(coupleId)
  const { data: budget } = useBudget(coupleId)
  const { data: tasks } = usePlanningTasks(coupleId)

  const days = website?.weddingDate ? daysUntilDate(website.weddingDate) : null
  const dateLabel = website?.weddingDate ? formatShortDate(website.weddingDate) : 'Date not set'

  const attending = guests?.filter(g => g.rsvpStatus === 'ATTENDING').length ?? 0
  const declining = guests?.filter(g => g.rsvpStatus === 'DECLINING').length ?? 0
  const pending = guests?.filter(g => g.rsvpStatus === 'PENDING').length ?? 0
  const totalGuests = guests?.length ?? 0
  const respondedPct = totalGuests > 0 ? Math.round(((attending + declining) / totalGuests) * 100) : 0

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

  return (
    <div className="mb-8 rounded-2xl border border-gold-light bg-gradient-to-br from-white to-ivory p-6 shadow-sm">
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
          sub={`${declining} declined · ${pending} pending · ${respondedPct}% responded`}
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
