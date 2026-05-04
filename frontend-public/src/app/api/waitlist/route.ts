import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body?.email || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const email = body.email.trim().toLowerCase()
  const name: string = typeof body.name === 'string' ? body.name.trim() : ''

  const apiKey = process.env.RESEND_API_KEY
  const audienceId = process.env.RESEND_AUDIENCE_ID

  if (!apiKey || !audienceId) {
    console.log(`[waitlist] New signup — email: ${email}, name: ${name || '(not provided)'}`)
    return NextResponse.json({ ok: true })
  }

  const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      first_name: name || undefined,
      unsubscribed: false,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[waitlist] Resend error:', res.status, text)
    return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
