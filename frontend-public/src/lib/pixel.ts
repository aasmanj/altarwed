'use client'

import { hasConsented } from '@/lib/consent'

// Fires Meta (Facebook) Pixel standard/custom events on the public site. The
// pixel snippet itself is installed by FacebookPixel.tsx, which only loads once
// the visitor has consented and only fires PageView. This helper adds the revenue
// funnel events (Lead on a vendor inquiry, etc.) on top of that snippet.
//
// Every call is gated the same way the snippet is:
//   - hasConsented() must be true (it also returns false under Global Privacy
//     Control), so we never track a visitor who declined or asserted GPC.
//   - window.fbq must already be installed (it only exists after FacebookPixel
//     loaded post-consent). If it is missing we silently no-op.
// Never pass PII (names, emails, addresses, free-text messages) in params; send
// only coarse, non-identifying descriptors so the pixel stays privacy-safe.
type Fbq = (...args: unknown[]) => void

export function trackPixelEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (!hasConsented()) return
  const fbq = (window as unknown as { fbq?: Fbq }).fbq
  if (typeof fbq !== 'function') return
  fbq('track', event, params)
}
