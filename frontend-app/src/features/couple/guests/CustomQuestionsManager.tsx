import { useState } from 'react'
import { toast } from 'sonner'
import {
  useCustomQuestions, useCreateCustomQuestion, useUpdateCustomQuestion,
  useDeleteCustomQuestion, useCustomQuestionAnswers,
  type CustomQuestion, type QuestionType,
} from './useCustomQuestions'
import { useConfirm } from '@/components/ConfirmDialog'

const TYPE_LABEL: Record<QuestionType, string> = {
  TEXT: 'Text answer', YES_NO: 'Yes / No', CHOICE: 'Multiple choice',
}

const inputCls = 'w-full rounded-lg border border-gold-light px-3 py-2 text-brown text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

// Couple-facing editor for custom RSVP questions plus a read-only view of the answers
// guests have given. Questions are answered once per RSVP submission (household-level).
export default function CustomQuestionsManager({ coupleId }: { coupleId: string }) {
  const { data: questions = [], isLoading } = useCustomQuestions(coupleId)
  const { data: answers = [] } = useCustomQuestionAnswers(coupleId)
  const createQ = useCreateCustomQuestion(coupleId)
  const updateQ = useUpdateCustomQuestion(coupleId)
  const deleteQ = useDeleteCustomQuestion(coupleId)
  const confirm = useConfirm()

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const answersByQuestion = new Map(answers.map(a => [a.questionId, a]))

  return (
    <div className="rounded-xl border border-gold-light bg-white p-6 mb-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brown">Custom RSVP questions</p>
          <p className="text-xs text-brown-light mt-0.5">
            Ask guests anything extra when they RSVP, like &ldquo;Any dietary or accessibility
            needs?&rdquo; Each question is answered once per RSVP.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setEditingId(null) }}
            className="shrink-0 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-brown hover:bg-gold-dark transition"
          >
            + Add question
          </button>
        )}
      </div>

      {adding && (
        <QuestionForm
          isPending={createQ.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={async (payload) => {
            const promise = createQ.mutateAsync(payload)
            toast.promise(promise, { loading: 'Adding question…', success: 'Question added', error: 'Could not add the question.' })
            try { await promise; setAdding(false) } catch { /* toast shows the error */ }
          }}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-brown-light animate-pulse" aria-busy="true">Loading questions…</p>
      ) : questions.length === 0 && !adding ? (
        <p className="text-sm text-brown-light italic">No custom questions yet.</p>
      ) : (
        <ul className="space-y-3">
          {questions.map(q => (
            <li key={q.id} className="rounded-lg border border-gold-light/70 p-4">
              {editingId === q.id ? (
                <QuestionForm
                  initial={q}
                  isPending={updateQ.isPending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (payload) => {
                    const promise = updateQ.mutateAsync({ questionId: q.id, payload })
                    toast.promise(promise, { loading: 'Saving…', success: 'Question updated', error: 'Could not save the question.' })
                    try { await promise; setEditingId(null) } catch { /* toast shows the error */ }
                  }}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brown">
                        {q.questionText}
                        {!q.active && <span className="ml-2 text-xs font-normal text-stone-400">(hidden)</span>}
                      </p>
                      <p className="text-xs text-brown-light mt-0.5">
                        {TYPE_LABEL[q.type]}
                        {q.required ? ' · required' : ''}
                        {q.type === 'CHOICE' && q.options.length > 0 ? ` · ${q.options.join(', ')}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        onClick={() => updateQ.mutate({ questionId: q.id, payload: { active: !q.active } })}
                        className="text-xs text-brown-light hover:text-brown"
                        title={q.active ? 'Hide from the RSVP form' : 'Show on the RSVP form'}
                      >
                        {q.active ? 'Hide' : 'Show'}
                      </button>
                      <button onClick={() => { setEditingId(q.id); setAdding(false) }} className="text-xs text-brown-light hover:text-brown">Edit</button>
                      <button
                        onClick={async () => {
                          if (await confirm({
                            title: 'Delete this question?',
                            message: 'The question and all guest answers to it will be permanently removed.',
                            tone: 'danger',
                            confirmLabel: 'Delete',
                          })) {
                            const promise = deleteQ.mutateAsync(q.id)
                            toast.promise(promise, { loading: 'Deleting…', success: 'Question deleted', error: 'Could not delete the question.' })
                            try { await promise } catch { /* toast shows the error */ }
                          }
                        }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <AnswerSummary data={answersByQuestion.get(q.id)} type={q.type} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Read-only roll-up of answers for one question: a tally for Yes/No and choice questions,
// a plain list for free text.
function AnswerSummary({ data, type }: {
  data?: { answers: { guestId: string; guestName: string; answerText: string }[] }
  type: QuestionType
}) {
  const answers = data?.answers ?? []
  if (answers.length === 0) {
    return <p className="mt-2 text-xs text-stone-400 italic">No responses yet.</p>
  }

  if (type === 'TEXT') {
    return (
      <ul className="mt-2 space-y-1">
        {answers.map(a => (
          <li key={a.guestId} className="text-xs text-brown-light">
            <span className="font-medium text-brown">{a.guestName}:</span> {a.answerText}
          </li>
        ))}
      </ul>
    )
  }

  // Tally identical answers for Yes/No and choice questions.
  const counts = answers.reduce<Record<string, number>>((acc, a) => {
    acc[a.answerText] = (acc[a.answerText] ?? 0) + 1
    return acc
  }, {})
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {Object.entries(counts).map(([value, count]) => (
        <span key={value} className="rounded-full bg-ivory border border-gold-light px-3 py-1 text-xs text-brown">
          {value} <span className="font-bold ml-1">{count}</span>
        </span>
      ))}
    </div>
  )
}

function QuestionForm({ initial, onSubmit, onCancel, isPending }: {
  initial?: CustomQuestion
  onSubmit: (payload: { questionText: string; type: QuestionType; options: string[]; required: boolean }) => void | Promise<void>
  onCancel: () => void
  isPending: boolean
}) {
  const [text, setText] = useState(initial?.questionText ?? '')
  const [type, setType] = useState<QuestionType>(initial?.type ?? 'TEXT')
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).join('\n'))
  const [required, setRequired] = useState(initial?.required ?? false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    const options = type === 'CHOICE'
      ? optionsText.split('\n').map(s => s.trim()).filter(Boolean)
      : []
    if (type === 'CHOICE' && options.length < 2) {
      toast.error('Add at least two choices, one per line.')
      return
    }
    onSubmit({ questionText: trimmed, type, options, required })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="cq-text" className="block text-xs font-medium text-brown-light mb-1">Question</label>
        <input
          id="cq-text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. Any dietary or accessibility needs?"
          maxLength={300}
          required
          className={inputCls}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="cq-type" className="block text-xs font-medium text-brown-light mb-1">Answer type</label>
          <select id="cq-type" value={type} onChange={e => setType(e.target.value as QuestionType)} className={inputCls}>
            <option value="TEXT">Text answer</option>
            <option value="YES_NO">Yes / No</option>
            <option value="CHOICE">Multiple choice</option>
          </select>
        </div>
        <label className="flex items-end gap-2 text-sm text-brown pb-2">
          <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="rounded border-gold-light" />
          Required to RSVP
        </label>
      </div>
      {type === 'CHOICE' && (
        <div>
          <label htmlFor="cq-options" className="block text-xs font-medium text-brown-light mb-1">Choices (one per line)</label>
          <textarea
            id="cq-options"
            value={optionsText}
            onChange={e => setOptionsText(e.target.value)}
            rows={3}
            placeholder={'Beef\nChicken\nVegetarian'}
            className={inputCls}
          />
        </div>
      )}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={isPending} className="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-brown hover:bg-gold-dark disabled:opacity-60 transition">
          {isPending ? 'Saving…' : initial ? 'Save' : 'Add question'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-gold-light px-4 py-1.5 text-sm font-medium text-brown hover:bg-ivory transition">
          Cancel
        </button>
      </div>
    </form>
  )
}
