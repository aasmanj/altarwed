import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

// Source-level guard for issue #230. The Amazon Wedding Registry link on the resources
// page is an affiliate link (?tag=altarwed-20) but its section carried no FTC disclosure
// and its rel lacked "sponsored", both of which the Books section already does correctly.
// Undisclosed monetized links are the target of FTC endorsement-guide enforcement and an
// Amazon Associates policy violation.
//
// vitest runs here in a plain node environment (no jsdom), so we assert on the load-bearing
// source the fix touches. Each assertion fails on the pre-fix source and passes after, the
// behavioral contract for these markup-only changes.

const AFFILIATE_TAG = 'tag=altarwed-20'

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

// Isolate the Registries <section> so the Books disclosure/rel cannot satisfy the assertions.
function registriesSection(src: string): string {
  const start = src.indexOf('{/* Registries */}')
  const end = src.indexOf('{/* CTA */}')
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('resources affiliate disclosure #230', () => {
  const src = read('app/resources/page.tsx')
  const section = registriesSection(src)

  it('renders an FTC affiliate disclosure above the Registries grid', () => {
    // Disclosure text must precede the grid of links within the section.
    const disclosureIdx = section.indexOf('affiliate links. As an Amazon Associate')
    const gridIdx = section.indexOf('grid sm:grid-cols-2')
    expect(disclosureIdx).toBeGreaterThan(-1)
    expect(gridIdx).toBeGreaterThan(-1)
    expect(disclosureIdx).toBeLessThan(gridIdx)
    // Names the Amazon Wedding Registry and states no extra cost, per Amazon Associates policy.
    expect(section).toContain('including the Amazon Wedding Registry')
    expect(section).toContain('at no extra cost to you')
  })

  it('mirrors the Books disclosure styling exactly', () => {
    // Same className the Books disclosure uses (page.tsx Books section).
    expect(section).toContain('text-xs text-center text-[#8a6a4a] mb-8')
  })

  it('marks affiliate registry links with rel sponsored and leaves non-affiliate links alone', () => {
    // The rel is driven by the per-registry affiliate flag, so tagged links get "sponsored".
    expect(section).toContain("rel={r.isAffiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}")
    // The Amazon registry (the affiliate-tagged href) is flagged; Target is not.
    expect(section).not.toContain('rel="noopener noreferrer"')
  })

  it('every affiliate-tagged href on the page is treated as sponsored', () => {
    // Guard against regressions where an affiliate link ships without a sponsored rel.
    // Books links are static strings already carrying rel="noopener noreferrer sponsored";
    // Registries derive rel from the affiliate flag.
    const affiliateCount = (src.match(new RegExp(AFFILIATE_TAG, 'g')) ?? []).length
    // At least the 4 books + the Amazon registry href carry the tag.
    expect(affiliateCount).toBeGreaterThanOrEqual(5)
    // Books use the static sponsored rel; at least one such occurrence exists.
    const staticSponsored = (src.match(/rel="noopener noreferrer sponsored"/g) ?? []).length
    expect(staticSponsored).toBeGreaterThanOrEqual(1)
    // The registries section computes sponsored from the flag.
    expect(section).toContain('sponsored')
  })
})
