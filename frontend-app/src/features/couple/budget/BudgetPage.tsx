import { useState } from 'react'
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

const CATEGORIES = Object.keys(CATEGORY_LABELS) as BudgetCategory[]

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
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

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Total Budget" value={fmt(summary.totalBudget)} color="stone" />
          <SummaryCard label="Actual Cost" value={fmt(summary.totalActual)} color="amber" />
          <SummaryCard label="Paid So Far" value={fmt(summary.totalPaid)} color="green" />
          <SummaryCard label="Remaining" value={fmt(summary.totalRemaining)} color="rose" />
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
            <div className="text-5xl mb-4">💰</div>
            <h3 className="text-lg font-medium text-stone-800 mb-2">No budget items yet</h3>
            <p className="text-stone-500 text-sm mb-6">
              Start tracking your wedding costs — from the venue to the tithe.
            </p>
            <button
              onClick={openAddForm}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              Add Your First Item
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
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
                          onClick={() => {
                            if (confirm('Remove this budget item?')) {
                              deleteItem.mutate(item.id)
                            }
                          }}
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
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
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
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
