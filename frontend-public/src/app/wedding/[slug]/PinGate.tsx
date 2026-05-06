'use client'

import { useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'

export default function PinGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const storageKey = `pinVerified_${slug}`
  const [verified, setVerified] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (sessionStorage.getItem(storageKey) === '1') setVerified(true)
  }, [storageKey])

  // Avoid flash — render nothing until we've checked sessionStorage
  if (!mounted) return null

  if (verified) return <>{children}</>

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${API_URL}/api/v1/wedding-websites/slug/${slug}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        sessionStorage.setItem(storageKey, '1')
        setVerified(true)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-[#e8dcc8] p-10 max-w-sm w-full text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[#a08060] mb-3">Private Wedding</p>
        <h1 className="font-serif text-2xl font-bold text-[#3b2f2f] mb-2">Enter PIN to View</h1>
        <p className="text-sm text-[#a08060] mb-8">
          The couple has protected this page. Enter the PIN they shared with you.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={10}
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="PIN"
            className="w-full border border-[#e8dcc8] rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-serif focus:outline-none focus:ring-2 focus:ring-[#d4af6a]"
            autoFocus
          />
          {error && (
            <p className="text-sm text-rose-600">Incorrect PIN. Please try again.</p>
          )}
          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full py-3 bg-[#3b2f2f] text-[#d4af6a] rounded-lg font-medium tracking-wide hover:bg-[#2a1f1f] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
        <p className="mt-6 text-xs text-[#a08060]">
          <a href="https://www.altarwed.com" className="hover:underline">Created with AltarWed</a>
        </p>
      </div>
    </div>
  )
}
