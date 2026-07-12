'use client'

import { useEffect, useState } from 'react'
import { safeColor } from '@/lib/safeColor'
import { safeNameFont, safeNameFontWeight } from '@/lib/safeFont'

// Origins allowed to send live-preview messages. The dashboard editor lives at
// app.altarwed.com in prod and on localhost during dev. Any postMessage from a
// different origin is ignored, important because postMessage is fundamentally
// cross-origin and we render this on a public domain.
const EDITOR_ORIGINS = [
  'https://app.altarwed.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

interface Props {
  initialTagline: string | null
  initialTaglineColor: string | null
  // Couple-chosen font KEY for the names (e.g. "cinzel"); mapped through safeNameFont.
  // null = default serif. Live-updated over postMessage like the tagline/names below.
  initialNameFont: string | null
  partnerOneName: string
  partnerTwoName: string
  // Wedding date + countdown blocks live under the names; pass them as children
  // so the parent owns the data fetching (they're not currently live-updated).
  children?: React.ReactNode
}

// Tagline + names header for the preview iframe. The hero needs to render
// instantly when the couple types in the editor; the standard pattern of
// "save to DB then reload iframe" feels laggy at typing speed. Instead the
// editor postMessages each keystroke and we update the DOM directly without
// a network round-trip.
//
// Tagline rules (must match the public layout):
//   - empty string  → render NOTHING (user intentionally cleared)
//   - null          → render the default "Together in covenant"
//   - any text      → render it as-is
export default function HeroLive({ initialTagline, initialTaglineColor, initialNameFont, partnerOneName, partnerTwoName, children }: Props) {
  const [tagline, setTagline] = useState<string | null>(initialTagline)
  const [taglineColor, setTaglineColor] = useState<string | null>(initialTaglineColor)
  const [nameFont, setNameFont] = useState<string | null>(initialNameFont)
  const [names, setNames] = useState({ one: partnerOneName, two: partnerTwoName })

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!EDITOR_ORIGINS.includes(e.origin)) return
      const data = e.data as { type?: string; field?: string; value?: unknown }
      if (data?.type !== 'preview-update') return
      if (data.field === 'heroTagline') {
        // value may be string or null; empty string is meaningful (hide tagline)
        setTagline(typeof data.value === 'string' ? data.value : null)
      } else if (data.field === 'heroTaglineColor') {
        setTaglineColor(typeof data.value === 'string' ? data.value : null)
      } else if (data.field === 'nameFont') {
        // The couple picked a font in the editor; reflect it instantly (safeNameFont
        // maps the key to a font-family, so an unknown value falls back to the serif).
        setNameFont(typeof data.value === 'string' ? data.value : null)
      } else if (data.field === 'partnerOneName') {
        setNames(n => ({ ...n, one: String(data.value ?? '') }))
      } else if (data.field === 'partnerTwoName') {
        setNames(n => ({ ...n, two: String(data.value ?? '') }))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Same font-family + weight mapping the live public hero uses, so the preview is
  // true to life. The ampersand takes only the family (its size/weight are fixed).
  const nameStyle = { fontFamily: safeNameFont(nameFont), fontWeight: safeNameFontWeight(nameFont) }

  // Structure mirrors the production hero in frontend-public/src/app/wedding/
  // [slug]/layout.tsx (stacked names with a gold ampersand rule). Font sizes
  // are intentionally one step smaller because the preview renders inside a
  // smaller iframe viewport. If you change one hero, update the other so the
  // WYSIWYG promise of the editor stays intact.
  return (
    <div className="relative z-10 text-center pb-8 px-6 w-full max-w-3xl mx-auto">
      {tagline !== '' && (
        <p
          className="mb-2 text-[10px] uppercase tracking-[0.3em] font-light"
          style={{ color: safeColor(taglineColor, 'rgba(255,255,255,0.7)') }}
        >
          {tagline ?? 'Together in covenant'}
        </p>
      )}
      <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold text-white leading-tight break-words text-balance" style={nameStyle}>
        {names.two}
      </h1>
      <div className="my-3 flex items-center justify-center gap-3">
        <div className="h-px w-12 bg-[#d4af6a]/60" />
        <span className="font-serif text-xl text-[#d4af6a]" style={{ fontFamily: nameStyle.fontFamily }} aria-hidden="true">&amp;</span>
        <div className="h-px w-12 bg-[#d4af6a]/60" />
      </div>
      <p className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold text-white leading-tight break-words text-balance" style={nameStyle}>
        {names.one}
      </p>
      {children}
    </div>
  )
}
