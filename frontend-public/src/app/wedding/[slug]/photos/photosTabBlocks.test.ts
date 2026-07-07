import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  blockHasContent,
  computeTabsWithContent,
  type WeddingPageBlock,
  type WeddingWebsite,
} from '@/app/wedding/[slug]/data'

// Issue #332: the public /wedding/[slug]/photos route bypassed the page-builder
// block pipeline entirely (it fetched /api/v1/wedding-photos and rendered
// PhotoGalleryClient directly), so a couple's edits on the editor's Photos tab
// had zero effect on the live site, and a Photos tab whose only content was a
// HEADING/TEXT block stayed hidden behind layout.tsx's photos-table-only nav gate.
//
// This fix routes /photos through TabBlocks (tab="PHOTOS") with the existing
// gallery grid as the zero-block fallback, and reveals the Photos nav link when
// the tab has block content OR uploaded photos.
//
// vitest runs here in a plain node environment (no jsdom / testing-library), so
// the pure nav-gating logic (computeTabsWithContent / blockHasContent, exported
// from data.ts) is tested directly, and the page + layout wiring is guarded at
// the source level, the same pattern as weddingNavScroll.test.ts.

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

// Minimal WeddingWebsite with no scalar content set; the block logic under test
// only reads the fields each block type references (none for HEADING/TEXT).
function bareWedding(overrides: Partial<WeddingWebsite> = {}): WeddingWebsite {
  return {
    id: 'w1',
    slug: 'jordan-and-taylor',
    isPublished: true,
    partnerOneName: 'Jordan',
    partnerTwoName: 'Taylor',
    weddingDate: null,
    heroPhotoUrl: null,
    heroTagline: null,
    heroFocalPointX: null,
    heroFocalPointY: null,
    heroTaglineColor: null,
    ourStory: null,
    scriptureReference: null,
    scriptureText: null,
    scriptureTranslation: null,
    venueName: null,
    venueAddress: null,
    venueCity: null,
    venueState: null,
    ceremonyTime: null,
    dressCode: null,
    venuePhotoUrl: null,
    venueAdditionalInfo: null,
    hotelName: null,
    hotelUrl: null,
    hotelDetails: null,
    registryUrl1: null,
    registryLabel1: null,
    registryUrl2: null,
    registryLabel2: null,
    registryUrl3: null,
    registryLabel3: null,
    rsvpDeadline: null,
    partnerOneVows: null,
    partnerTwoVows: null,
    hiddenTabs: null,
    customTabLabels: null,
    accentColor: null,
    scriptureBackgroundColor: null,
    ...overrides,
  }
}

function block(overrides: Partial<WeddingPageBlock> & Pick<WeddingPageBlock, 'type' | 'contentJson'>): WeddingPageBlock {
  return {
    id: 'b1',
    weddingWebsiteId: 'w1',
    tab: 'PHOTOS',
    sortOrder: 0,
    ...overrides,
  }
}

describe('Photos nav gate treats block content as content-bearing (#332)', () => {
  it('a PHOTOS HEADING block with text is content-bearing even with zero uploaded photos', () => {
    const b = block({ type: 'HEADING', contentJson: JSON.stringify({ text: 'Our Gallery', level: 2 }) })
    // hasPhotosPresent = false: no photos uploaded, only a block.
    expect(blockHasContent(b, bareWedding(), false, false)).toBe(true)
    const tabs = computeTabsWithContent([b], bareWedding(), false, false)
    expect(tabs.has('PHOTOS')).toBe(true)
  })

  it('a PHOTOS TEXT block with markdown is content-bearing with zero uploaded photos', () => {
    const b = block({ type: 'TEXT', contentJson: JSON.stringify({ markdown: 'A note about our photos.' }) })
    expect(computeTabsWithContent([b], bareWedding(), false, false).has('PHOTOS')).toBe(true)
  })

  it('a PHOTO_ALBUM_GRID block is content-bearing only when photos exist (live site hides an empty grid)', () => {
    const b = block({ type: 'PHOTO_ALBUM_GRID', contentJson: '{}' })
    // No photos: the grid renders nothing on the live site, so it is NOT content.
    expect(blockHasContent(b, bareWedding(), false, false)).toBe(false)
    expect(computeTabsWithContent([b], bareWedding(), false, false).has('PHOTOS')).toBe(false)
    // With photos uploaded, the grid is content-bearing.
    expect(blockHasContent(b, bareWedding(), false, true)).toBe(true)
    expect(computeTabsWithContent([b], bareWedding(), false, true).has('PHOTOS')).toBe(true)
  })

  it('an empty PHOTOS tab (a DIVIDER only, no photos) is NOT content-bearing, so the tab stays hidden', () => {
    const b = block({ type: 'DIVIDER', contentJson: '{}' })
    expect(computeTabsWithContent([b], bareWedding(), false, false).has('PHOTOS')).toBe(false)
  })
})

describe('layout.tsx reveals the Photos nav link on blocks OR photos (#332)', () => {
  const src = read('app/wedding/[slug]/layout.tsx')

  it('the Photos gate ORs uploaded photos with block content', () => {
    expect(src).toContain("const hasPhotos   = hasPhotosPresent || tabsWithContent.has('PHOTOS')")
  })

  it('Photos is no longer gated on the photos table alone', () => {
    expect(src).not.toMatch(/const hasPhotos\s*=\s*hasPhotosPresent\s*$/m)
  })
})

describe('photos/page.tsx renders through TabBlocks with the gallery as fallback (#332)', () => {
  const src = read('app/wedding/[slug]/photos/page.tsx')

  it('renders TabBlocks for the PHOTOS tab instead of PhotoGalleryClient directly', () => {
    expect(src).toContain("import TabBlocks from '@/components/blocks/TabBlocks'")
    expect(src).toContain('<TabBlocks slug={slug} tab="PHOTOS" wedding={wedding} fallback={fallback} />')
  })

  it('keeps the existing photo grid + empty state as the zero-block fallback (no regression)', () => {
    // The fallback still fetches photos and renders the unchanged gallery grid /
    // "Photos coming soon" empty state for photo-only sites.
    expect(src).toContain('const fallback = (')
    expect(src).toContain('<PhotoGalleryClient')
    expect(src).toContain('Photos coming soon')
    expect(src).toContain('/api/v1/wedding-photos/website/slug/')
  })
})
