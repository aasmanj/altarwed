'use client'

import { useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function WaitlistForm({ className }: { className?: string }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Something went wrong')
      }

      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (status === 'success') {
    return (
      <div className={`text-center ${className}`}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-sage/20 mb-4">
          <svg className="w-7 h-7 text-sage-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-serif text-xl text-brown font-semibold mb-1">You&apos;re on the list!</p>
        <p className="text-brown/60 text-sm">
          We&apos;ll reach out as soon as AltarWed launches. God bless your planning.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Your first name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-4 py-3 rounded-lg border border-gold/30 bg-white/80 text-brown placeholder-brown/40 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-transparent transition text-sm"
        />
        <input
          type="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1 px-4 py-3 rounded-lg border border-gold/30 bg-white/80 text-brown placeholder-brown/40 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-transparent transition text-sm"
        />
        <button
          type="submit"
          disabled={status === 'loading' || !email}
          className="px-6 py-3 bg-gold text-white font-semibold rounded-lg hover:bg-gold-dark transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap text-sm shadow-md"
        >
          {status === 'loading' ? 'Joining…' : 'Join the Waitlist'}
        </button>
      </div>

      {status === 'error' && (
        <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
      )}

      <p className="mt-3 text-xs text-brown/40 text-center sm:text-left">
        No spam, ever. Unsubscribe at any time.
      </p>
    </form>
  )
}
