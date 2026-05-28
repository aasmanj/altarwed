'use client'

import { useState } from 'react'

interface Props {
  vendorId: string
  vendorBusinessName: string
}

type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; detail: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'

export default function InquiryForm({ vendorId, vendorBusinessName }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [weddingDate, setWeddingDate] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'idle' })

  const charCount = message.length
  const charLimit = 2000
  const tooLong = charCount > charLimit

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state.kind === 'submitting') return
    setState({ kind: 'submitting' })

    try {
      const res = await fetch(`${API_URL}/api/v1/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          coupleName: name.trim(),
          coupleEmail: email.trim(),
          weddingDate: weddingDate.trim() || null,
          message: message.trim(),
        }),
      })

      if (res.status === 202) {
        setState({ kind: 'success' })
        return
      }

      if (res.status === 429) {
        setState({ kind: 'error', detail: 'You have sent a few inquiries already. Please wait a minute and try again.' })
        return
      }

      // Surface backend validation message when available; otherwise a generic
      // error so we never leak exception traces.
      let detail = 'Something went wrong sending your inquiry. Please try again.'
      try {
        const body = await res.json()
        if (typeof body?.detail === 'string') detail = body.detail
      } catch { /* ignore body parse failures */ }
      setState({ kind: 'error', detail })
    } catch {
      setState({
        kind: 'error',
        detail: 'We could not reach the server. Please check your connection and try again.',
      })
    }
  }

  if (state.kind === 'success') {
    return (
      <div
        className="rounded-2xl border border-[#d4af6a] bg-white p-6"
        role="status"
        aria-live="polite"
      >
        <p className="font-serif text-lg font-semibold text-[#3b2f2f] mb-2">
          Your inquiry is on its way to {vendorBusinessName}
        </p>
        <p className="text-sm text-[#6b5344] mb-4">
          Check your inbox for a confirmation. {vendorBusinessName} will reply directly to your email, typically within 1 to 3 business days.
        </p>
        <a
          href="https://app.altarwed.com/register"
          className="inline-block rounded-xl bg-[#3b2f2f] px-5 py-2 font-semibold text-white hover:bg-[#5c4033] transition text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a] focus-visible:ring-offset-2"
        >
          Start planning your wedding for free →
        </a>
      </div>
    )
  }

  const submitting = state.kind === 'submitting'

  return (
    <div className="rounded-2xl border border-[#e8dcc8] bg-white p-6">
      <p className="font-serif text-lg font-semibold text-[#3b2f2f] mb-1">
        Send {vendorBusinessName} an inquiry
      </p>
      <p className="text-sm text-[#6b5344] mb-5">
        They reply directly to your email. No account needed.
      </p>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Your name"
          id="inquiry-name"
          value={name}
          onChange={setName}
          required
          maxLength={120}
          autoComplete="name"
          placeholder="Jordan and Eden-Faith"
          disabled={submitting}
        />
        <Field
          label="Your email"
          id="inquiry-email"
          type="email"
          value={email}
          onChange={setEmail}
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
          disabled={submitting}
          hint="They will reply to this address."
        />
        <Field
          label="Wedding date"
          id="inquiry-date"
          value={weddingDate}
          onChange={setWeddingDate}
          maxLength={60}
          placeholder="Summer 2026 (or skip if undecided)"
          disabled={submitting}
        />

        <div>
          <label htmlFor="inquiry-message" className="block text-sm font-medium text-[#3b2f2f] mb-1">
            Message <span className="text-red-500" aria-hidden="true">*</span>
            <span className="sr-only">required</span>
          </label>
          <textarea
            id="inquiry-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            rows={5}
            maxLength={charLimit + 200}
            placeholder={`Hi ${vendorBusinessName}, we are getting married and would love to learn more about your availability and pricing...`}
            disabled={submitting}
            aria-describedby="message-counter"
            className="w-full rounded-lg border border-[#e8dcc8] px-4 py-3 text-sm text-[#3b2f2f] focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a] disabled:opacity-60"
          />
          <p
            id="message-counter"
            className={`text-xs mt-1 ${tooLong ? 'text-red-600' : 'text-[#a08060]'}`}
          >
            {charCount} / {charLimit}{tooLong ? ' (over limit)' : ''}
          </p>
        </div>

        {state.kind === 'error' && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {state.detail}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || tooLong || !name.trim() || !email.trim() || message.trim().length < 10}
          className="w-full sm:w-auto rounded-xl bg-[#3b2f2f] px-6 py-2.5 font-semibold text-white hover:bg-[#5c4033] disabled:opacity-50 disabled:cursor-not-allowed transition text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af6a] focus-visible:ring-offset-2"
        >
          {submitting ? 'Sending...' : 'Send inquiry'}
        </button>

        <p className="text-xs text-[#a08060]">
          By sending an inquiry you agree to share your name, email, and message with {vendorBusinessName}.
        </p>
      </form>
    </div>
  )
}

function Field({
  label, id, value, onChange, required, type = 'text', maxLength, autoComplete, placeholder, disabled, hint,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  maxLength?: number
  autoComplete?: string
  placeholder?: string
  disabled?: boolean
  hint?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[#3b2f2f] mb-1">
        {label}
        {required && (
          <>
            <span className="text-red-500" aria-hidden="true"> *</span>
            <span className="sr-only"> required</span>
          </>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={hintId}
        className="w-full rounded-lg border border-[#e8dcc8] px-4 py-3 text-sm text-[#3b2f2f] focus:border-[#d4af6a] focus:outline-none focus:ring-1 focus:ring-[#d4af6a] disabled:opacity-60"
      />
      {hint && (
        <p id={hintId} className="text-xs text-[#a08060] mt-1">{hint}</p>
      )}
    </div>
  )
}
