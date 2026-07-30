import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Source-scan guard for the unpublished-draft gate. Tab pages render in PARALLEL
// with the layout in the App Router, so the layout's ComingSoon gate cannot
// protect them: a segment-level RSC request (client-side tab navigation, or a
// hand-crafted RSC fetch) renders the page component alone. Any page under
// /wedding/[slug] that fetches the wedding via getWedding instead of
// getPublishedWedding would serve an unpublished draft's venue/story/party data
// on that path (the exact leak issue #91 closed on the backend). This test makes
// the rule survive new tabs: every page.tsx in this route MUST fetch through
// getPublishedWedding and MUST NOT call getWedding directly. The layout is the
// single allowed getWedding caller (it needs the draft to render ComingSoon).
const routeDir = join(__dirname)

function collectPageFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectPageFiles(full))
    else if (entry === 'page.tsx') out.push(full)
  }
  return out
}

describe('unpublished-draft gate on /wedding/[slug] tab pages', () => {
  const pages = collectPageFiles(routeDir)

  it('finds the tab pages (sanity check the scan itself)', () => {
    // 8 today: home, story, details, travel, wedding-party, photos, rsvp, registry.
    expect(pages.length).toBeGreaterThanOrEqual(8)
  })

  it.each(pages.map(p => [relative(routeDir, p) || 'page.tsx', p]))(
    '%s gates drafts via getPublishedWedding, never getWedding',
    (_name, file) => {
      const src = readFileSync(file as string, 'utf8')
      expect(src, 'must fetch through getPublishedWedding (see data.ts)').toContain('getPublishedWedding')
      expect(src, 'must not call getWedding directly; only the layout may').not.toMatch(/\bgetWedding\s*\(/)
    },
  )
})
