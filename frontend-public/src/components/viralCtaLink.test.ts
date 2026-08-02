import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ViralCtaLink is a thin client wrapper: it renders an <a href> and fires a
// consent-gated Meta Pixel Lead event onClick, so growth can measure CTA clicks
// (issue #550). vitest runs in a node environment here (no jsdom / testing-library),
// matching the sibling public tests, so instead of rendering to a DOM we invoke the
// component as a plain function to reach its element props, then exercise the
// onClick handler. Consent is mocked and window.fbq stubbed exactly like the
// sibling pixel.test.ts so we control the consent decision and capture the event.
const consented = vi.fn<() => boolean>()
vi.mock('@/lib/consent', () => ({
  hasConsented: () => consented(),
}))

const fbq = vi.fn()

beforeEach(() => {
  fbq.mockClear()
  consented.mockReset()
  vi.stubGlobal('window', { fbq })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

interface AnchorProps {
  href: string
  className?: string
  onClick: () => void
  children: unknown
}

async function anchorPropsOf(props: {
  href: string
  source: string
  className?: string
  children: unknown
}): Promise<AnchorProps> {
  const { default: ViralCtaLink } = await import('./ViralCtaLink')
  const element = ViralCtaLink(props) as { props: AnchorProps }
  return element.props
}

describe('ViralCtaLink (issue #550)', () => {
  it('renders the given href and fires a Lead event tagged with source when consented and the pixel is loaded', async () => {
    consented.mockReturnValue(true)
    const { href, onClick } = await anchorPropsOf({
      href: 'https://app.altarwed.com/register?utm_campaign=viral-footer',
      source: 'viral-footer',
      children: 'Start for free',
    })

    expect(href).toBe('https://app.altarwed.com/register?utm_campaign=viral-footer')

    onClick()

    expect(fbq).toHaveBeenCalledTimes(1)
    expect(fbq).toHaveBeenCalledWith('track', 'Lead', { source: 'viral-footer' })
  })

  it('no-ops the pixel when the visitor has not consented', async () => {
    consented.mockReturnValue(false)
    const { onClick } = await anchorPropsOf({
      href: '#',
      source: 'rsvp-thankyou',
      children: 'x',
    })

    onClick()

    expect(fbq).not.toHaveBeenCalled()
  })

  it('no-ops safely when the pixel snippet has not installed window.fbq yet', async () => {
    consented.mockReturnValue(true)
    vi.stubGlobal('window', {})
    const { onClick } = await anchorPropsOf({
      href: '#',
      source: 'rsvp-entry',
      children: 'x',
    })

    expect(() => onClick()).not.toThrow()
    expect(fbq).not.toHaveBeenCalled()
  })
})
