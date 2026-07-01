import { describe, it, expect } from 'vitest'
import { buildContentSecurityPolicy } from '@/lib/csp'

// Parse a CSP header string into { directive: [sources] } for readable assertions.
function parse(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/).filter(Boolean)
    if (name) out[name] = values
  }
  return out
}

describe('buildContentSecurityPolicy', () => {
  it('locks down the risky sinks the issue cares about', () => {
    const d = parse(buildContentSecurityPolicy())
    expect(d['default-src']).toEqual(["'self'"])
    expect(d['object-src']).toEqual(["'none'"])
    expect(d['base-uri']).toEqual(["'self'"])
    // No external script sources beyond self + the Meta Pixel loader; an injected
    // `<script src="https://evil.example">` is refused.
    expect(d['script-src']).toContain("'self'")
    expect(d['script-src']).toContain('https://connect.facebook.net')
  })

  it('never allows eval or the dev websocket in production', () => {
    const d = parse(buildContentSecurityPolicy({ isDev: false }))
    expect(d['script-src']).not.toContain("'unsafe-eval'")
    expect(d['connect-src']).not.toContain('ws:')
    expect(buildContentSecurityPolicy({ isDev: false })).toContain('upgrade-insecure-requests')
  })

  it('relaxes only what dev tooling needs (eval, ws, no upgrade)', () => {
    const csp = buildContentSecurityPolicy({ isDev: true })
    const d = parse(csp)
    expect(d['script-src']).toContain("'unsafe-eval'")
    expect(d['connect-src']).toContain('ws:')
    // upgrade-insecure-requests on http://localhost would break dev subresources.
    expect(csp).not.toContain('upgrade-insecure-requests')
  })

  it('keeps existing functionality working (blob images, Meta Pixel, API fetch)', () => {
    const d = parse(buildContentSecurityPolicy({ apiOrigin: 'https://altarwed-prod-api.azurewebsites.net' }))
    // Blob storage images + arbitrary https content images + data URIs.
    expect(d['img-src']).toEqual(expect.arrayContaining(["'self'", 'data:', 'https:']))
    // Client components fetch the backend API and the Meta Pixel beacons.
    expect(d['connect-src']).toContain('https://altarwed-prod-api.azurewebsites.net')
    expect(d['connect-src']).toContain('https://www.facebook.com')
    // Meta Pixel cookie-matching iframe.
    expect(d['frame-src']).toContain('https://www.facebook.com')
  })

  it('reduces a full API URL to its origin for connect-src', () => {
    const d = parse(buildContentSecurityPolicy({ apiOrigin: 'https://api.example.com/api/v1/' }))
    expect(d['connect-src']).toContain('https://api.example.com')
    expect(d['connect-src']).not.toContain('https://api.example.com/api/v1/')
  })

  it('lets the dashboard iframe embed the /preview route (frame-ancestors)', () => {
    // frontend-app (app.altarwed.com) embeds /preview/[slug]/[tab]; a bare
    // frame-ancestors 'self' would break the block editor preview.
    const d = parse(buildContentSecurityPolicy({ appOrigin: 'https://app.altarwed.com' }))
    expect(d['frame-ancestors']).toContain("'self'")
    expect(d['frame-ancestors']).toContain('https://app.altarwed.com')
  })

  it('falls back to the prod API origin when the env var is unset or invalid', () => {
    expect(parse(buildContentSecurityPolicy({ apiOrigin: undefined }))['connect-src'])
      .toContain('https://altarwed-prod-api.azurewebsites.net')
    expect(parse(buildContentSecurityPolicy({ apiOrigin: 'not-a-url' }))['connect-src'])
      .toContain('https://altarwed-prod-api.azurewebsites.net')
  })
})
