import { describe, it, expect } from 'vitest'
import { BLOB_STORAGE, buildContentSecurityPolicy } from './csp'
// next.config.ts lives at the workspace root, outside src/, so the @/ alias cannot
// reach it; this parent import is the only way to test the emitted images config.
// eslint-disable-next-line no-restricted-imports
import nextConfig from '../../next.config'

// Issue #98: the media pipeline must reference only OUR storage account, never the
// *.blob.core.windows.net wildcard, which covers every Azure customer's account and
// would let the Next image optimizer fetch and decode an attacker-hosted image
// (decompression bomb) on the shared SSR server.
describe('blob host narrowing (issue #98)', () => {
  it('pins BLOB_STORAGE to the prod storage account with no wildcard', () => {
    expect(BLOB_STORAGE).toBe('https://altarwedprodstorage.blob.core.windows.net')
    expect(BLOB_STORAGE).not.toContain('*')
  })

  it('emits the pinned host, not a wildcard, in CSP media-src', () => {
    const csp = buildContentSecurityPolicy({ isDev: false })
    const mediaSrc = csp.split(';').find(d => d.trim().startsWith('media-src'))
    expect(mediaSrc).toContain('https://altarwedprodstorage.blob.core.windows.net')
    expect(mediaSrc).not.toContain('*.blob.core.windows.net')
  })

  it('restricts image optimizer remotePatterns to the pinned host only', () => {
    const patterns = nextConfig.images?.remotePatterns ?? []
    expect(patterns).toHaveLength(1)
    expect(patterns[0]).toMatchObject({
      protocol: 'https',
      hostname: 'altarwedprodstorage.blob.core.windows.net',
    })
    for (const p of patterns) {
      expect(String(p.hostname)).not.toContain('*')
    }
  })
})
