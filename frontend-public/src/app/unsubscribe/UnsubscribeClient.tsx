'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function UnsubscribeClient() {
  const params = useSearchParams()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const h = params.get('h')
  const tok = params.get('tok')
  // The couple param scopes the opt-out to one wedding. It is part of the signed token
  // payload (hash:coupleId), so it MUST be forwarded or verification fails and the
  // unsubscribe silently 400s. Absent for welcome mail and pre-scoping legacy links.
  const c = params.get('c')

  useEffect(() => {
    if (!h || !tok) {
      setStatus('error')
      setMessage('This unsubscribe link is invalid or has expired. Contact hello@altarwed.com for help.')
      return
    }

    setStatus('loading')
    const cParam = c ? `&c=${encodeURIComponent(c)}` : ''
    fetch(`${API}/api/v1/unsubscribe?h=${encodeURIComponent(h)}&tok=${encodeURIComponent(tok)}${cParam}`, {
      method: 'POST',
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus('success')
          setMessage(c
            ? "You've been unsubscribed. You will no longer receive emails from this couple's AltarWed wedding."
            : "You've been unsubscribed. You will no longer receive AltarWed emails at this address.")
        } else {
          const data = await res.json().catch(() => ({}))
          setStatus('error')
          setMessage(data.error ?? 'This link is invalid or has already been used.')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Something went wrong. Please try again or contact hello@altarwed.com.')
      })
  }, [h, tok])

  if (status === 'loading' || status === 'idle') {
    return <p className="text-sm text-[#6b5344]">Processing your request&hellip;</p>
  }

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-4 text-sm text-green-800">
        <strong>Done.</strong> {message}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-800">
      <strong>Problem.</strong> {message}
    </div>
  )
}
