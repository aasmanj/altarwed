import { ImageResponse } from 'next/og'

// File-based OpenGraph image convention. Because this lives at the app root, it
// becomes the og:image for every route that does not define its own — so every
// shared link (homepage, blog, vendor pages) renders a branded preview instead
// of the 404 that /og-image.png was. Generated with next/og (built in, no dep),
// so it is self-hosted and stays in sync with the brand. No custom font is
// loaded on purpose: fetching remote font data at the edge is the usual cause
// of OG-image build failures, and the default sans is fine for a wordmark card.

// No runtime pin: next/og runs on the default Node runtime in Next 14, which
// Azure's hosting supports. Forcing 'edge' would fail on hosts without edge
// functions.
export const alt = 'AltarWed — Christian Wedding Planning Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#3b2f2f',
          color: '#fdfaf6',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* No decorative glyphs (e.g. ✦): they are absent from the default
            font and next/og cannot fetch a dynamic one at build, which renders
            them as blank boxes. The gold rule below carries the brand accent. */}
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>
          AltarWed
        </div>
        <div
          style={{
            display: 'flex',
            width: 120,
            height: 3,
            backgroundColor: '#d4af6a',
            margin: '32px 0',
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 40,
            color: 'rgba(232,220,200,0.92)',
            textAlign: 'center',
            maxWidth: 820,
          }}
        >
          Faith-first wedding planning for Christian couples
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            color: 'rgba(232,220,200,0.6)',
            marginTop: 28,
            fontFamily: 'Arial, sans-serif',
          }}
        >
          Free wedding website · Guest list · Faith-aligned vendors
        </div>
      </div>
    ),
    { ...size },
  )
}
