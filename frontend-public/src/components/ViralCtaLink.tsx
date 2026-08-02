'use client'

import type { ReactNode } from 'react'
import { trackPixelEvent } from '@/lib/pixel'

// A viral "create your own wedding site" CTA anchor that fires a consent-gated
// Meta Pixel Lead event on click, so growth can measure CTA clicks and not just
// completed signups. All gating lives inside trackPixelEvent: with no consent or
// no pixel key the snippet never installs window.fbq, so the click silently
// no-ops and the anchor still navigates normally (progressive enhancement, the
// link keeps working with JavaScript disabled). `source` is a coarse,
// non-identifying surface tag (viral-footer, rsvp-thankyou, rsvp-entry), never PII.
//
// Kept deliberately tiny and reusable so the server-rendered wedding footer, the
// RSVP entry affordance, and the client RSVP form all share one instrumented anchor.
interface ViralCtaLinkProps {
  href: string
  source: string
  className?: string
  children: ReactNode
}

export default function ViralCtaLink({ href, source, className, children }: ViralCtaLinkProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => trackPixelEvent('Lead', { source })}
    >
      {children}
    </a>
  )
}
