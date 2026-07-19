'use client'

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import Script from 'next/script'

// Shared Cloudflare Turnstile integration for every public form that submits to a
// captcha-gated backend endpoint. Built for the RSVP find-invitation search (issue
// #89) and extracted to a hook when the vendor inquiry form gained the same
// protection (issue #100), so the subtle parts (single-use token reset, the bounded
// ready-gate, the never-re-latch guard) exist exactly once.

// Cloudflare Turnstile's browser API. Declared narrowly to just the two calls
// this hook uses (render, reset); see window.turnstile docs.
interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
    },
  ) => string
  reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

// A Managed Turnstile challenge normally resolves in well under this window; if
// it hasn't by then (Cloudflare outage, network issue, aggressive blocker), stop
// gating the submit button on it rather than leaving a visitor permanently stuck.
// The submission itself still runs, backend-enforced: if a captcha secret is
// actually configured, that one request 400s and the form's existing error path
// handles it, which beats a form the visitor can never submit.
export const TURNSTILE_READY_TIMEOUT_MS = 6000

export interface TurnstileControls {
  /** Latest single-use token, or '' while none is ready. Send it with the request. */
  captchaToken: string
  /** True while a configured widget has not yet produced its first token; gate the submit button on it. */
  waitingOnCaptcha: boolean
  /** Call after EVERY submit attempt (success or failure): tokens are single-use. */
  resetCaptcha: () => void
  /** Render this once inside the form; null when no site key is configured. */
  turnstileSlot: ReactNode
}

export function useTurnstile(): TurnstileControls {
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [turnstileGaveUp, setTurnstileGaveUp] = useState(false)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  // NEXT_PUBLIC_TURNSTILE_SITE_KEY is public by design (Cloudflare site keys are
  // meant to ship to the browser); the secret half never leaves the backend. Unset
  // in an environment with no Turnstile site configured yet, in which case this
  // hook renders nothing and the backend (also unconfigured) verifies every
  // request rather than breaking the feature -- see CloudflareTurnstileAdapter.
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // Whether Turnstile has EVER produced a token this session. A ref, not state,
  // because the timeout callback below needs its current value without
  // re-running the effect that schedules it. Once true, the 6s "give up" timer
  // must never re-latch turnstileGaveUp: Turnstile demonstrably works in this
  // browser, so a later reset()-in-flight moment (between submissions) should not
  // be permanently treated the same as "the script never loaded at all".
  const everReceivedTokenRef = useRef(false)

  // Render the widget explicitly (rather than the implicit `cf-turnstile` div
  // convention) so we can reset it after every submission: a Turnstile token is
  // single-use, and re-mounting a fresh widget per attempt would flash/reflow
  // the layout every time.
  useEffect(() => {
    if (!siteKey || !turnstileLoaded || !turnstileContainerRef.current || widgetIdRef.current) return
    widgetIdRef.current = window.turnstile!.render(turnstileContainerRef.current, {
      sitekey: siteKey,
      callback: token => {
        everReceivedTokenRef.current = true
        setCaptchaToken(token)
      },
      'error-callback': () => setCaptchaToken(''),
      'expired-callback': () => setCaptchaToken(''),
    })
  }, [siteKey, turnstileLoaded])

  // Bounded wait for a token before giving up on gating the button (see
  // TURNSTILE_READY_TIMEOUT_MS above). Cleared on unmount so it never fires
  // after the widget has already produced a token or the page has moved on.
  // Only actually gives up if no token has EVER arrived: without the ref check,
  // this would also fire during the brief window after a post-submit reset()
  // (captchaToken momentarily empty again) and permanently disable the
  // ready-gate for the rest of the session even though Turnstile is working fine.
  useEffect(() => {
    if (!siteKey) return
    const timer = setTimeout(() => {
      if (!everReceivedTokenRef.current) setTurnstileGaveUp(true)
    }, TURNSTILE_READY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [siteKey])

  const resetCaptcha = useCallback(() => {
    if (siteKey && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
    setCaptchaToken('')
  }, [siteKey])

  const waitingOnCaptcha = Boolean(siteKey) && !captchaToken && !turnstileGaveUp

  const turnstileSlot = siteKey ? (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setTurnstileLoaded(true)}
      />
      <div ref={turnstileContainerRef} />
    </>
  ) : null

  return { captchaToken, waitingOnCaptcha, resetCaptcha, turnstileSlot }
}
