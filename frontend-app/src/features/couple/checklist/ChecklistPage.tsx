import { useEffect, useRef, useState, useCallback } from 'react'
import confetti from 'canvas-confetti'
import {
  ChevronDown, ChevronRight, AlertTriangle, CalendarClock, CalendarRange, CalendarDays, CheckCircle2,
  Cross, Gem, Landmark, Camera, ClipboardList, Shirt, Users, PartyPopper, Plane,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import TipCallout from '@/components/TipCallout'
import { useConfirm } from '@/components/ConfirmDialog'
import { TIPS } from '@/lib/tips'
import { dueDateBefore, formatMonthYear } from '@/lib/date'
import { useWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import {
  usePlanningTasks, useToggleTask, useAddTask, useDeleteTask,
  type PlanningTask, type TaskCategory,
} from './usePlanningTasks'

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  FAITH:     'Faith & Spiritual',
  CEREMONY:  'Ceremony',
  VENUE:     'Venue',
  VENDORS:   'Vendors',
  LEGAL:     'Legal',
  ATTIRE:    'Attire',
  GUESTS:    'Guests',
  RECEPTION: 'Reception',
  HONEYMOON: 'Honeymoon',
}

// Icons render in the section headers. The <select> below uses the plain text
// label only, since <option> cannot render a component.
const CATEGORY_ICON: Record<TaskCategory, LucideIcon> = {
  FAITH:     Cross,
  CEREMONY:  Gem,
  VENUE:     Landmark,
  VENDORS:   Camera,
  LEGAL:     ClipboardList,
  ATTIRE:    Shirt,
  GUESTS:    Users,
  RECEPTION: PartyPopper,
  HONEYMOON: Plane,
}

const CATEGORY_ORDER: TaskCategory[] = [
  'FAITH', 'CEREMONY', 'VENUE', 'VENDORS', 'LEGAL', 'ATTIRE', 'GUESTS', 'RECEPTION', 'HONEYMOON',
]

const ALL_CATEGORIES = CATEGORY_ORDER

// Timeline buckets sort incomplete tasks by how soon they are due, relative to
// the wedding date. Completed tasks always land in the "done" bucket so a couple
// sees their wins collected in one place.
type Bucket = 'overdue' | 'thisMonth' | 'soon' | 'later' | 'noDate' | 'done'

const BUCKET_ORDER: Bucket[] = ['overdue', 'thisMonth', 'soon', 'later', 'noDate', 'done']

const BUCKET_META: Record<Bucket, { label: string; icon: LucideIcon; tone: string }> = {
  overdue:   { label: 'Needs attention',      icon: AlertTriangle, tone: 'text-rose-500' },
  thisMonth: { label: 'This month',           icon: CalendarClock, tone: 'text-gold' },
  soon:      { label: 'Coming up, next 3 months', icon: CalendarRange, tone: 'text-gold' },
  later:     { label: 'Later on',             icon: CalendarDays,  tone: 'text-brown-light' },
  noDate:    { label: 'No timing yet',        icon: CalendarDays,  tone: 'text-brown-light' },
  done:      { label: 'Completed',            icon: CheckCircle2,  tone: 'text-green-600' },
}

const DAY_MS = 86_400_000

// Encouraging celebration copy keyed by the milestone just crossed.
const MILESTONE_MSG: Record<number, string> = {
  25:  'A quarter of the way there. Great start.',
  50:  'Halfway done. You two make a good team.',
  75:  'Three quarters complete. The finish line is in sight.',
  100: 'Every task is done. You are ready for the big day.',
}

interface DatedTask {
  task: PlanningTask
  dueDate: Date | null
  bucket: Bucket
}

function classify(task: PlanningTask, weddingDate: string | null): DatedTask {
  if (task.isCompleted) return { task, dueDate: null, bucket: 'done' }
  if (weddingDate == null || task.dueMonthsBefore == null) {
    return { task, dueDate: null, bucket: 'noDate' }
  }
  const dueDate = dueDateBefore(weddingDate, task.dueMonthsBefore)
  const days = Math.ceil((dueDate.getTime() - Date.now()) / DAY_MS)
  const bucket: Bucket = days < 0 ? 'overdue' : days <= 30 ? 'thisMonth' : days <= 90 ? 'soon' : 'later'
  return { task, dueDate, bucket }
}

export default function ChecklistPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''

  const { data: tasks = [], isLoading } = usePlanningTasks(coupleId)
  const { data: website } = useWeddingWebsite(coupleId)
  const weddingDate = website?.weddingDate ?? null
  const toggle = useToggleTask(coupleId)
  const addTask = useAddTask(coupleId)
  const deleteTask = useDeleteTask(coupleId)

  const [showAdd, setShowAdd] = useState(false)
  const [filterDone, setFilterDone] = useState<'all' | 'todo' | 'done'>('all')
  // Timeline is the default view: it answers "are we on track?" at a glance.
  // Category stays available for couples who think in terms of areas.
  const [view, setView] = useState<'timeline' | 'category'>('timeline')

  const total     = tasks.length
  const completed = tasks.filter(t => t.isCompleted).length
  const progress  = total > 0 ? Math.round((completed / total) * 100) : 0

  const dated = tasks.map(t => classify(t, weddingDate))
  const overdueCount = dated.filter(d => d.bucket === 'overdue').length

  // Milestone celebration: fire confetti once each time the couple crosses a
  // 25/50/75/100 threshold upward. milestoneRef is seeded on first load so an
  // already-in-progress checklist does not fire on mount.
  const milestoneRef = useRef<number | null>(null)
  const [celebrateMsg, setCelebrateMsg] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    if (total === 0) return
    const current =
      progress >= 100 ? 100 : progress >= 75 ? 75 : progress >= 50 ? 50 : progress >= 25 ? 25 : 0
    if (milestoneRef.current === null) { milestoneRef.current = current; return }
    if (current > milestoneRef.current) {
      milestoneRef.current = current
      const msg = MILESTONE_MSG[current]
      if (msg) {
        setCelebrateMsg(msg)
        setAnnounce(msg)
        confetti({
          particleCount: current === 100 ? 220 : 120,
          spread: current === 100 ? 100 : 70,
          origin: { y: 0.4 },
          colors: ['#d4af6a', '#3b2f2f', '#f5ede0', '#22c55e'],
        })
      }
    } else if (current < milestoneRef.current) {
      milestoneRef.current = current
    }
  }, [progress, total])

  // Auto-dismiss the celebration banner. Keyed on celebrateMsg (not the milestone
  // effect) so a new crossing within the 5s window restarts the timer cleanly
  // instead of leaving a prior message stuck with no pending cleanup.
  useEffect(() => {
    if (!celebrateMsg) return
    const t = setTimeout(() => setCelebrateMsg(null), 5000)
    return () => clearTimeout(t)
  }, [celebrateMsg])

  // The headline status line: warm, honest, and tied to the timeline so it
  // reads "we're on track" when things are calm and "let's catch up" when not.
  function statusLine(): string {
    if (total === 0) return 'Your checklist is ready when you are.'
    if (progress === 100) return 'Every task is done. You are all set.'
    if (overdueCount > 0) return `A few things need attention, but you have got this.`
    if (progress >= 75) return 'So close. The finish line is in sight.'
    if (progress >= 25) return 'You are on track. Keep going.'
    return 'Great start. One task at a time.'
  }

  const filtered = dated.filter(d => {
    if (filterDone === 'todo') return !d.task.isCompleted
    if (filterDone === 'done') return d.task.isCompleted
    return true
  })

  const handleAdd = useCallback(async (title: string, category: TaskCategory) => {
    await addTask.mutateAsync({ title, category })
    setShowAdd(false)
  }, [addTask])

  // Timeline view only makes sense once we know the wedding date. Without it,
  // fall back to the category view and nudge the couple to set the date.
  const timelineReady = weddingDate != null
  const activeView = timelineReady ? view : 'category'

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Wedding Checklist"
        subtitle="Faith-first planning, every step of the way"
        maxWidth="max-w-3xl"
        action={
          <button
            onClick={() => setShowAdd(v => !v)}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
          >
            + Add task
          </button>
        }
      />

      {/* Screen-reader announcements for milestone celebrations. */}
      <div role="status" aria-live="polite" className="sr-only">{announce}</div>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <TipCallout tip={TIPS.checklistFaith} />
        </div>

        {/* Status + progress */}
        <div className="mb-8 rounded-2xl border border-gold-light bg-gradient-to-br from-white to-ivory p-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="font-serif text-lg font-semibold text-brown">{statusLine()}</p>
              <p className="text-sm text-brown-light mt-0.5">{completed} of {total} tasks complete</p>
            </div>
            <span className="font-serif text-3xl font-bold text-gold shrink-0">{progress}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-ivory overflow-hidden">
            <div
              className="h-full rounded-full bg-gold transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {celebrateMsg && (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-green-700">
              <PartyPopper className="w-4 h-4 shrink-0" aria-hidden="true" />
              {celebrateMsg}
            </p>
          )}
          {overdueCount > 0 && !celebrateMsg && (
            <p className="mt-3 flex items-center gap-2 text-sm text-rose-600">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {overdueCount} task{overdueCount !== 1 ? 's' : ''} past its target date. No stress, just pick one to start.
            </p>
          )}
        </div>

        {showAdd && (
          <AddTaskModal
            onClose={() => setShowAdd(false)}
            onSubmit={handleAdd}
            isPending={addTask.isPending}
          />
        )}

        {/* View toggle + filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {timelineReady ? (
            <div className="inline-flex rounded-lg border border-gold-light bg-white p-0.5" role="group" aria-label="Group tasks by">
              {(['timeline', 'category'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                    view === v ? 'bg-gold text-white' : 'text-brown-light hover:text-brown'
                  }`}
                >
                  {v === 'timeline' ? 'By timeline' : 'By category'}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-brown-light">
              Add your wedding date in the Website tab to see tasks grouped by what is due next.
            </p>
          )}

          <div className="flex gap-1 border-b border-gold-light">
            {(['all', 'todo', 'done'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterDone(f)}
                aria-pressed={filterDone === f}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                  filterDone === f ? 'border-gold text-brown' : 'border-transparent text-brown-light hover:text-brown'
                }`}
              >
                {f === 'all' ? 'All tasks' : f === 'todo' ? 'To do' : 'Done'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <ChecklistSkeleton />
        ) : total === 0 ? (
          <EmptyState />
        ) : activeView === 'timeline' ? (
          <TimelineView
            dated={filtered}
            onToggle={(task) => toggle.mutate({ taskId: task.id, isCompleted: !task.isCompleted })}
            onSaveDetails={(task, payload) => toggle.mutate({ taskId: task.id, ...payload })}
            onDelete={(task) => deleteTask.mutate(task.id)}
          />
        ) : (
          <CategoryView
            dated={filtered}
            onToggle={(task) => toggle.mutate({ taskId: task.id, isCompleted: !task.isCompleted })}
            onSaveDetails={(task, payload) => toggle.mutate({ taskId: task.id, ...payload })}
            onDelete={(task) => deleteTask.mutate(task.id)}
          />
        )}
      </main>
    </div>
  )
}

function AddTaskModal({ onClose, onSubmit, isPending }: {
  onClose: () => void
  onSubmit: (title: string, category: TaskCategory) => Promise<void>
  isPending: boolean
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<TaskCategory>('FAITH')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await onSubmit(title.trim(), category)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-dialog-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 id="add-task-dialog-title" className="font-serif text-lg font-semibold text-brown">
            Add a custom task
          </h2>
          <button
            onClick={onClose}
            className="text-brown-light hover:text-brown text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="add-task-title" className="block text-xs font-medium text-brown-light mb-1">Task name *</label>
            <input
              ref={inputRef}
              id="add-task-title"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Book rehearsal dinner"
              className="w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <div>
            <label htmlFor="add-task-category" className="block text-xs font-medium text-brown-light mb-1">Category</label>
            <select
              id="add-task-category"
              value={category}
              onChange={e => setCategory(e.target.value as TaskCategory)}
              className="w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            >
              {ALL_CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition"
            >
              {isPending ? 'Adding…' : 'Add task'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold-light px-5 py-2 text-sm font-medium text-brown hover:bg-ivory transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

type RowHandlers = {
  onToggle: (task: PlanningTask) => void
  onSaveDetails: (task: PlanningTask, payload: { notes: string; assignee: string }) => void
  onDelete: (task: PlanningTask) => void
}

function sortDated(a: DatedTask, b: DatedTask): number {
  if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime()
  if (a.dueDate) return -1
  if (b.dueDate) return 1
  return a.task.sortOrder - b.task.sortOrder
}

function TimelineView({ dated, ...handlers }: { dated: DatedTask[] } & RowHandlers) {
  const grouped = BUCKET_ORDER.map(bucket => ({
    bucket,
    items: dated.filter(d => d.bucket === bucket).sort(sortDated),
  })).filter(g => g.items.length > 0)

  if (grouped.length === 0) return <NoMatches />

  return (
    <div className="space-y-8">
      {grouped.map(({ bucket, items }) => {
        const meta = BUCKET_META[bucket]
        const Icon = meta.icon
        const done = items.filter(d => d.task.isCompleted).length
        return (
          <div key={bucket}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 font-serif text-base font-semibold text-brown">
                <Icon className={`w-4 h-4 ${meta.tone}`} aria-hidden="true" />
                {meta.label}
              </h2>
              <span className="text-xs text-brown-light">
                {bucket === 'done' ? items.length : `${done}/${items.length}`}
              </span>
            </div>
            <div className="rounded-xl border border-gold-light bg-white overflow-hidden divide-y divide-gold-light/50">
              {items.map(d => (
                <TaskRow key={d.task.id} dated={d} {...handlers} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryView({ dated, ...handlers }: { dated: DatedTask[] } & RowHandlers) {
  const byCategory = CATEGORY_ORDER.map(cat => ({
    cat,
    items: dated.filter(d => d.task.category === cat),
  })).filter(g => g.items.length > 0)

  if (byCategory.length === 0) return <NoMatches />

  return (
    <div className="space-y-8">
      {byCategory.map(({ cat, items }) => {
        const done = items.filter(d => d.task.isCompleted).length
        const CatIcon = CATEGORY_ICON[cat]
        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 font-serif text-base font-semibold text-brown">
                <CatIcon className="w-4 h-4 text-gold" aria-hidden="true" />
                {CATEGORY_LABEL[cat]}
              </h2>
              <span className="text-xs text-brown-light">{done}/{items.length}</span>
            </div>
            <div className="rounded-xl border border-gold-light bg-white overflow-hidden divide-y divide-gold-light/50">
              {items.map(d => (
                <TaskRow key={d.task.id} dated={d} {...handlers} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChecklistSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading your checklist">
      {[0, 1].map(s => (
        <div key={s}>
          <div className="h-4 w-40 rounded bg-gold-light/60 mb-3 animate-pulse" />
          <div className="rounded-xl border border-gold-light bg-white divide-y divide-gold-light/50">
            {[0, 1, 2].map(r => (
              <div key={r} className="flex items-center gap-4 px-5 py-4">
                <div className="h-5 w-5 rounded border-2 border-gold-light shrink-0" />
                <div className="h-3.5 w-2/3 rounded bg-ivory animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gold-light bg-white p-10 text-center">
      <ClipboardList className="mx-auto w-8 h-8 text-gold" aria-hidden="true" />
      <p className="mt-3 font-serif text-lg text-brown">Your checklist is being prepared</p>
      <p className="mt-1 text-sm text-brown-light">
        We will fill it with faith-first planning steps. Refresh in a moment, or add your own task above.
      </p>
    </div>
  )
}

function NoMatches() {
  return (
    <p className="rounded-xl border border-gold-light bg-white px-5 py-8 text-center text-sm text-brown-light">
      Nothing here yet. Try a different filter.
    </p>
  )
}

function TaskRow({ dated, onToggle, onSaveDetails, onDelete }: { dated: DatedTask } & RowHandlers) {
  const { task, dueDate, bucket } = dated
  const confirm = useConfirm()
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [assignee, setAssignee] = useState(task.assignee ?? '')

  // Re-sync when the upstream task changes (e.g. after a server refresh) but
  // only when collapsed, so in-progress edits aren't clobbered.
  useEffect(() => {
    if (!expanded) {
      setNotes(task.notes ?? '')
      setAssignee(task.assignee ?? '')
    }
  }, [task.notes, task.assignee, expanded])

  const isDirty =
    notes !== (task.notes ?? '') || assignee !== (task.assignee ?? '')

  return (
    <div className={`transition ${task.isCompleted ? 'bg-green-50/30' : 'hover:bg-ivory/40'}`}>
      <div className="flex items-center gap-4 px-5 py-4">
        <button
          onClick={() => onToggle(task)}
          className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 ${
            task.isCompleted
              ? 'border-green-500 bg-green-500 text-white'
              : 'border-gold-light hover:border-gold'
          }`}
          aria-label={task.isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.isCompleted && (
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <p className={`text-sm font-medium ${task.isCompleted ? 'line-through text-brown-light' : 'text-brown'}`}>
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-brown-light mt-0.5">
            {bucket === 'overdue' && (
              <span className="inline-flex items-center gap-1 font-medium text-rose-600">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                Past target
              </span>
            )}
            {dueDate ? (
              <span>Aim for by {formatMonthYear(dueDate)}</span>
            ) : task.dueMonthsBefore != null ? (
              <span>~{task.dueMonthsBefore} month{task.dueMonthsBefore !== 1 ? 's' : ''} before</span>
            ) : null}
            {task.assignee && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ivory px-2 py-0.5 text-brown">
                {task.assignee}
              </span>
            )}
          </div>
          {/* Show the actual note when collapsed so couples don't have to expand
              every task to remember what they wrote. */}
          {!expanded && task.notes && (
            <p className="mt-1.5 text-xs text-stone-600 line-clamp-2 whitespace-pre-line border-l-2 border-gold-light pl-2">
              {task.notes}
            </p>
          )}
        </button>

        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 text-brown-light hover:text-brown"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <button
          onClick={async () => {
            if (await confirm({
              title: `Delete "${task.title}"?`,
              message: 'This task will be removed from your checklist.',
              tone: 'danger',
              confirmLabel: 'Delete',
            })) onDelete(task)
          }}
          className="shrink-0 text-xs text-red-300 hover:text-red-500 transition"
        >
          Remove
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-1 space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-brown-light mb-1">Assigned to</span>
            <input
              type="text"
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              placeholder="e.g. Bride, Groom, Maid of honor"
              className="w-full rounded-lg border border-gold-light px-3 py-2 text-sm text-brown focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-brown-light mb-1">Notes</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Vendor contact, deadline, payment status…"
              className="w-full rounded-lg border border-gold-light px-3 py-2 text-sm text-brown leading-relaxed focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold resize-y min-h-[88px]"
            />
          </label>
          <div className="flex items-center gap-3 pt-0.5">
            <button
              onClick={() => {
                onSaveDetails(task, { notes, assignee })
                setExpanded(false)
              }}
              disabled={!isDirty}
              className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold-dark disabled:opacity-50 transition"
            >
              Save details
            </button>
            {isDirty && (
              <button
                onClick={() => {
                  setNotes(task.notes ?? '')
                  setAssignee(task.assignee ?? '')
                }}
                className="text-xs text-brown-light hover:text-brown"
              >
                Reset
              </button>
            )}
            {!isDirty && (notes || assignee) && (
              <span className="text-xs text-green-600">Saved</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
