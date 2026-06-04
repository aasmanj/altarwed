import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { useAuth } from '@/core/auth/AuthContext'
import PageHeader from '@/components/PageHeader'
import {
  useBudget,
  useCreateBudgetItem,
  useUpdateBudgetItem,
  useDeleteBudgetItem,
  CATEGORY_LABELS,
  BudgetCategory,
  BudgetItem,
} from './useBudget'
import { useWeddingWebsite, useUpdateWeddingWebsite } from '@/features/couple/website/useWeddingWebsite'
import TipCallout from '@/components/TipCallout'
import { useConfirm } from '@/components/ConfirmDialog'
import { TIPS } from '@/lib/tips'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as BudgetCategory[]

// Hide the native number-input spinner arrows. They look cheap next to dollar
// amounts and invite mis-clicks. Couples type the figure; they never step it.
const NO_SPINNER =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

function fmt(n: number | null | undefined) {
  if (n == null) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

interface FormState {
  category: BudgetCategory
  vendorName: string
  estimatedCost: string
  actualCost: string
  isPaid: boolean
  notes: string
}

const emptyForm = (): FormState => ({
  category: 'OTHER',
  vendorName: '',
  estimatedCost: '',
  actualCost: '',
  isPaid: false,
  notes: '',
})

export default function BudgetPage() {
  const { user } = useAuth()
  const coupleId = user?.id ?? ''
  const { data, isLoading } = useBudget(coupleId)
  const createItem = useCreateBudgetItem(coupleId)
  const updateItem = useUpdateBudgetItem(coupleId)
  const deleteItem = useDeleteBudgetItem(coupleId)
  const { data: website } = useWeddingWebsite(coupleId)
  const updateWebsite = useUpdateWeddingWebsite(coupleId)
  const confirm = useConfirm()

  async function confirmDeleteItem(id: string) {
    if (await confirm({
      title: 'Remove this budget item?',
      tone: 'danger',
      confirmLabel: 'Remove',
    })) {
      deleteItem.mutate(id)
    }
  }

  // Goal input is a separate, debounced local state so typing feels instant
  // and the PATCH doesn't fire on every keystroke.
  const [goalInput, setGoalInput] = useState<string>('')
  useEffect(() => {
    setGoalInput(website?.goalBudget != null ? String(website.goalBudget) : '')
  }, [website?.goalBudget])
  function commitGoal() {
    const parsed = goalInput.trim() === '' ? null : parseFloat(goalInput)
    const next = parsed != null && !Number.isNaN(parsed) && parsed >= 0 ? parsed : null
    if (next === (website?.goalBudget ?? null)) return
    updateWebsite.mutate({ goalBudget: next as unknown as number })
  }

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())

  function openAddForm() {
    setEditingId(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEditForm(item: BudgetItem) {
    setEditingId(item.id)
    setForm({
      category: item.category,
      vendorName: item.vendorName,
      estimatedCost: String(item.estimatedCost),
      actualCost: item.actualCost != null ? String(item.actualCost) : '',
      isPaid: item.isPaid,
      notes: item.notes ?? '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      category: form.category,
      vendorName: form.vendorName.trim(),
      estimatedCost: parseFloat(form.estimatedCost) || 0,
      actualCost: form.actualCost !== '' ? parseFloat(form.actualCost) : undefined,
      isPaid: form.isPaid,
      notes: form.notes.trim() || undefined,
    }
    if (editingId) {
      await updateItem.mutateAsync({ itemId: editingId, ...payload })
    } else {
      await createItem.mutateAsync(payload)
    }
    closeForm()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    )
  }

  const summary = data!
  const paidPercent = summary.totalActual > 0
    ? Math.round((summary.totalPaid / summary.totalActual) * 100)
    : 0
  const goal = website?.goalBudget ?? null
  const goalPercent = goal && goal > 0
    ? Math.min(100, Math.round((summary.totalActual / goal) * 100))
    : 0
  const goalOver = goal != null && summary.totalActual > goal

  return (
    <div className="min-h-screen bg-ivory">
      <PageHeader
        title="Budget Tracker"
        subtitle="Track your wedding costs with peace of mind"
        action={
          <button
            onClick={openAddForm}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition"
          >
            + Add item
          </button>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <TipCallout tip={TIPS.budgetGoal} />

        {/* Goal vs Spent */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-stone-800">Budget goal</p>
              <p className="text-xs text-stone-500">
                Set a target so you know when you're going over.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-stone-500">$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onBlur={commitGoal}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                placeholder="e.g. 25000"
                className={`w-32 border border-stone-300 rounded-lg px-3 py-2 text-sm text-right focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${NO_SPINNER}`}
              />
            </div>
          </div>
          {goal != null && goal > 0 ? (
            <>
              <div className="flex justify-between text-xs text-stone-600 mb-1.5">
                <span>{fmt(summary.totalActual)} of {fmt(goal)} spent</span>
                <span className={goalOver ? 'text-rose-600 font-semibold' : ''}>
                  {goalPercent}%{goalOver ? ' · over goal' : ''}
                </span>
              </div>
              <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    goalOver ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${goalPercent}%` }}
                />
              </div>
              {/* Encouraging, faith-warm feedback. Couples obsess over going over
                  budget; reward the good case and frame the over case gently. */}
              {summary.totalActual > 0 && (
                <p className={`text-xs mt-2.5 font-medium ${goalOver ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {goalOver
                    ? `You're ${fmt(summary.totalActual - goal)} over your goal. Trim a category or nudge the target, you've got this.`
                    : goalPercent >= 90
                      ? `Cutting it close, but still under budget with ${fmt(goal - summary.totalActual)} to spare. Well managed.`
                      : `On track and under budget with ${fmt(goal - summary.totalActual)} of room left. Beautifully done.`}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-stone-400 italic">No goal set yet.</p>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Total Budget" value={fmt(summary.totalBudget)} color="stone" />
          <SummaryCard label="Actual Cost" value={fmt(summary.totalActual)} color="amber" />
          <SummaryCard label="Paid So Far" value={fmt(summary.totalPaid)} color="green" />
          <SummaryCard label="Yet to be paid" value={fmt(summary.totalRemaining)} color="rose" />
        </div>

        {/* Progress bar */}
        {summary.totalActual > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex justify-between text-sm text-stone-600 mb-2">
              <span>Payment Progress</span>
              <span>{paidPercent}% paid</span>
            </div>
            <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${paidPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Item list */}
        {summary.items.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-stone-300" />
            <h3 className="text-lg font-medium text-stone-800 mb-2">No budget items yet</h3>
            <p className="text-stone-500 text-sm mb-6">
              Start tracking your wedding costs, from the venue to the tithe.
            </p>
            <button
              onClick={openAddForm}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              Add Your First Item
            </button>
          </div>
        ) : (
          <>
            {/* Mobile card list (hidden on sm+) */}
            <div className="sm:hidden space-y-3">
              {summary.items.map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-stone-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-stone-800 text-sm truncate">{item.vendorName}</p>
                      <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium mt-0.5">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      {item.notes && (
                        <p className="text-xs text-stone-400 mt-1">{item.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => updateItem.mutate({ itemId: item.id, isPaid: !item.isPaid })}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          item.isPaid ? 'bg-green-500 border-green-500 text-white' : 'border-stone-300 hover:border-green-400'
                        }`}
                      >
                        {item.isPaid && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <button onClick={() => openEditForm(item)} className="text-stone-400 hover:text-stone-700 p-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => confirmDeleteItem(item.id)} className="text-stone-400 hover:text-rose-500 p-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-stone-500">
                    <span>Est: <span className="font-medium text-stone-700">{fmt(item.estimatedCost)}</span></span>
                    <span>Actual: <span className="font-medium text-stone-700">{fmt(item.actualCost)}</span></span>
                    {item.isPaid && <span className="text-green-600 font-medium">Paid</span>}
                  </div>
                </div>
              ))}
              <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 flex justify-between text-sm font-semibold text-stone-700">
                <span>Totals</span>
                <div className="flex gap-4">
                  <span>{fmt(summary.totalBudget)}</span>
                  <span>{fmt(summary.totalActual)}</span>
                </div>
              </div>
            </div>

            {/* Desktop table (hidden on mobile) */}
            <div className="hidden sm:block bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-stone-500 text-xs uppercase tracking-wide">
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Vendor / Item</th>
                      <th className="px-5 py-3 text-right">Estimated</th>
                      <th className="px-5 py-3 text-right">Actual</th>
                      <th className="px-5 py-3 text-center">Paid</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {summary.items.map(item => (
                      <tr key={item.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                        <td className="px-5 py-3">
                          <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                            {CATEGORY_LABELS[item.category]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-stone-800 font-medium">
                          {item.vendorName}
                          {item.notes && (
                            <p className="text-xs text-stone-400 mt-0.5 font-normal">{item.notes}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-stone-600">{fmt(item.estimatedCost)}</td>
                        <td className="px-5 py-3 text-right text-stone-600">{fmt(item.actualCost)}</td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => updateItem.mutate({ itemId: item.id, isPaid: !item.isPaid })}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
                              item.isPaid
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-stone-300 hover:border-green-400'
                            }`}
                          >
                            {item.isPaid && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditForm(item)}
                              className="text-stone-400 hover:text-stone-700 transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => confirmDeleteItem(item.id)}
                              className="text-stone-400 hover:text-rose-500 transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-stone-50 font-semibold text-stone-700">
                      <td className="px-5 py-3" colSpan={2}>Totals</td>
                      <td className="px-5 py-3 text-right">{fmt(summary.totalBudget)}</td>
                      <td className="px-5 py-3 text-right">{fmt(summary.totalActual)}</td>
                      <td />
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-stone-900 mb-5">
              {editingId ? 'Edit Budget Item' : 'Add Budget Item'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as BudgetCategory }))}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Vendor / Item Name</label>
                <input
                  required
                  value={form.vendorName}
                  onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))}
                  placeholder="e.g. Sunrise Photography"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Estimated Cost</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.estimatedCost}
                    onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))}
                    placeholder="0.00"
                    className={`w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${NO_SPINNER}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Actual Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.actualCost}
                    onChange={e => setForm(f => ({ ...f, actualCost: e.target.value }))}
                    placeholder="0.00"
                    className={`w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${NO_SPINNER}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Deposit paid, contract signed, etc."
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPaid}
                  onChange={e => setForm(f => ({ ...f, isPaid: e.target.checked }))}
                  className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-stone-700">Marked as paid</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-2.5 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createItem.isPending || updateItem.isPending}
                  className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  {editingId ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    stone: 'bg-stone-50 border-stone-200 text-stone-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
  }
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}
