import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useGuests } from '@/features/couple/guests/useGuests'
import { useBudget } from '@/features/couple/budget/useBudget'
import { usePlanningTasks } from '@/features/couple/checklist/usePlanningTasks'
import type { WeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import { daysUntilDate, formatShortDate } from '@/lib/date'

function useCountUp(target: number, duration: number): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (duration === 0 || target === 0) { setValue(target); return }
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

interface Props {
  coupleId: string
  website: WeddingWebsite | undefined
}

export default function AtAGlanceCard({ coupleId, website }: Props) {
  const shouldReduce = useReducedMotion()
  const countDuration = shouldReduce ? 0 : 800

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

  const animDays = useCountUp(Math.abs(days ?? 0), countDuration)
  const animAttending = useCountUp(attending, countDuration)
  const animGuests = useCountUp(totalGuests, countDuration)

  return (
    <div className="mb-8 rounded-2xl border border-gold-light bg-gradient-to-br from-white to-ivory p-6 shadow-sm">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Wedding day"
          primary={days === null ? '—' : days > 0 ? `${animDays}` : days === 0 ? 'Today!' : `${animDays}`}
          suffix={days === null ? '' : days > 0 ? 'days to go' : days === 0 ? '' : 'days ago'}
          sub={dateLabel}
        />
        <Metric
          label="RSVPs"
          primary={`${animAttending}`}
          suffix={`of ${animGuests} attending`}
          sub={`${declining} declined · ${pending} pending · ${respondedPct}% responded`}
        />
        <Metric
          label="Budget"
          primary={goal > 0 ? `$${spent.toLocaleString()}` : '—'}
          suffix={goal > 0 ? `of $${goal.toLocaleString()}` : 'No goal set'}
          sub={goal > 0 ? (overBudget ? `Over by $${(spent - goal).toLocaleString()}` : `${budgetPct}% of goal`) : 'Set a goal in Budget'}
          bar={goal > 0 ? { pct: budgetPct, color: overBudget ? 'bg-rose-500' : 'bg-gold' } : undefined}
        />
        <Metric
          label="Checklist"
          primary={`${checklistPct}%`}
          suffix={`${doneTasks} of ${totalTasks} done`}
          sub={checklistPct === 100 ? 'All done!' : `${totalTasks - doneTasks} remaining`}
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
