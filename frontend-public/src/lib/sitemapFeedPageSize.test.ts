import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { WEDDING_FEED_PAGE_SIZE } from './sitemapData'

// Issue #241 guard: the sitemap loader treats a page with fewer than
// WEDDING_FEED_PAGE_SIZE rows as the last page, so this constant MUST equal the
// backend's server-side clamp (WeddingWebsiteService.MAX_SITEMAP_PAGE_SIZE). If the
// server ceiling were ever lowered below this value, every full page would come back
// short and the walk would stop after page 0, silently dropping most sites from the
// sitemap. Nothing at the type level couples the two numbers across the Java/TS
// boundary, so we cross-check them at the source level. Both live in one monorepo,
// so reading the Java source here is safe and deterministic in CI.
describe('sitemap feed page size stays in sync with the backend clamp', () => {
  it('matches WeddingWebsiteService.MAX_SITEMAP_PAGE_SIZE', () => {
    const servicePath = resolve(
      process.cwd(),
      '..',
      'backend/src/main/java/com/altarwed/application/service/WeddingWebsiteService.java',
    )
    const source = readFileSync(servicePath, 'utf8')

    const match = source.match(/MAX_SITEMAP_PAGE_SIZE\s*=\s*(\d+)/)
    expect(
      match,
      'could not find MAX_SITEMAP_PAGE_SIZE in WeddingWebsiteService.java; the constant was renamed or removed',
    ).not.toBeNull()

    const backendClamp = Number(match![1])
    expect(WEDDING_FEED_PAGE_SIZE).toBe(backendClamp)
  })
})
