import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import {
  usePlanningTasks, useToggleTask, useAddTask, useDeleteTask,
  type PlanningTask, type TaskCategory,
} from './usePlanningTasks'

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  FAITH:     '✝️  Faith & Spiritual',
  CEREMONY:  '💍 Ceremony',
  VENUE:     '🏛️  Venue',
  VENDORS:   '📸 Vendors',
  LEGAL:     '📋 Legal',
  ATTIRE:    '👗 Attire',
  GUESTS:    '💌 Guests',
  RECEPTION: '🎉 Reception',
  HONEYMOON: '✈️  Honeymoon',
}

const CATEGORY_ORDER: TaskCategory[] = [
  'FAITH', 'CEREMONY', 'VENUE', 'VENDORS', 'LEGAL', 'ATTIRE', 'GUESTS', 'RECEPTION', 'HONEYMOON',
]

const ALL_CATEGORIES = CATEGORY_ORDER

export default function ChecklistPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''

  const { data: tasks = [], isLoading } = usePlanningTasks(coupleId)
  const toggle = useToggleTask(coupleId)
  const addTask = useAddTask(coupleId)
  const deleteTask = useDeleteTask(coupleId)

  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState<TaskCategory>('FAITH')
  const [filterDone, setFilterDone] = useState<'all' | 'todo' | 'done'>('all')

  const total     = tasks.length
  const completed = tasks.filter(t => t.isCompleted).length
  const progress  = total > 0 ? Math.round((completed / total) * 100) : 0

  const filtered = tasks.filter(t => {
    if (filterDone === 'todo') return !t.isCompleted
    if (filterDone === 'done') return t.isCompleted
    return true
  })

  const grouped = CATEGORY_ORDER.reduce<Record<TaskCategory, PlanningTask[]>>((acc, cat) => {
    acc[cat] = filtered.filter(t => t.category === cat)
    return acc
  }, {} as Record<TaskCategory, PlanningTask[]>)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await addTask.mutateAsync({ title: newTitle.trim(), category: newCategory })
    setNewTitle('')
    setShowAdd(false)
  }

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-gold-light bg-white px-6 py-4 flex items-center justify-between">
        <Link to="/dashboard" className="font-serif text-xl font-bold text-brown">AltarWed</Link>
        <Link to="/dashboard" className="text-sm text-brown-light hover:text-brown transition">
          ← Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-2xl font-bold text-brown">Wedding Checklist</h1>
            <p className="text-brown-light text-sm mt-1">Faith-first planning, every step of the way</p>
          </div>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition"
          >
            + Add task
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-8 rounded-2xl border border-gold-light bg-white p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-brown">{completed} of {total} tasks complete</span>
            <span className="text-sm font-bold text-gold">{progress}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-ivory overflow-hidden">
            <div
              className="h-full rounded-full bg-gold transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Add task form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="mb-6 rounded-xl border border-gold bg-white p-5 space-y-4">
            <p className="font-medium text-brown text-sm">New custom task</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-brown-light mb-1">Task name *</label>
                <input
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Book rehearsal dinner"
                  className="w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brown-light mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as TaskCategory)}
                  className="w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                >
                  {ALL_CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={addTask.isPending}
                className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60 transition">
                {addTask.isPending ? 'Adding…' : 'Add task'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="rounded-lg border border-gold-light px-5 py-2 text-sm font-medium text-brown hover:bg-ivory transition">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 border-b border-gold-light">
          {(['all', 'todo', 'done'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterDone(f)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition capitalize ${
                filterDone === f ? 'border-gold text-brown' : 'border-transparent text-brown-light hover:text-brown'
              }`}
            >
              {f === 'all' ? 'All tasks' : f === 'todo' ? 'To do' : 'Done'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-center text-brown-light py-16 animate-pulse">Loading your checklist…</p>
        ) : (
          <div className="space-y-8">
            {CATEGORY_ORDER.map(cat => {
              const catTasks = grouped[cat]
              if (catTasks.length === 0) return null
              const catDone = catTasks.filter(t => t.isCompleted).length
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-serif text-base font-semibold text-brown">
                      {CATEGORY_LABEL[cat]}
                    </h2>
                    <span className="text-xs text-brown-light">{catDone}/{catTasks.length}</span>
                  </div>
                  <div className="rounded-xl border border-gold-light bg-white overflow-hidden divide-y divide-gold-light/50">
                    {catTasks.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={() => toggle.mutate({ taskId: task.id, isCompleted: !task.isCompleted })}
                        onDelete={() => deleteTask.mutate(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function TaskRow({ task, onToggle, onDelete }: {
  task: PlanningTask
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 transition ${task.isCompleted ? 'bg-green-50/30' : 'hover:bg-ivory/40'}`}>
      <button
        onClick={onToggle}
        className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition ${
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

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.isCompleted ? 'line-through text-brown-light' : 'text-brown'}`}>
          {task.title}
        </p>
        {task.dueMonthsBefore != null && (
          <p className="text-xs text-brown-light mt-0.5">
            ~{task.dueMonthsBefore} month{task.dueMonthsBefore !== 1 ? 's' : ''} before the wedding
          </p>
        )}
      </div>

      {!task.isSeeded && (
        <button
          onClick={() => { if (confirm(`Delete "${task.title}"?`)) onDelete() }}
          className="shrink-0 text-xs text-red-300 hover:text-red-500 transition"
        >
          Remove
        </button>
      )}
    </div>
  )
}
