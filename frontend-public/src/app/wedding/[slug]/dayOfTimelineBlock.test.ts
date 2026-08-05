import { describe, it, expect } from 'vitest'
import { blockHasContent, type WeddingPageBlock, type WeddingWebsite } from './data'

// Issue #574: DAY_OF_TIMELINE is the first block type whose content lives entirely
// in contentJson as an array. blockHasContent decides whether a tab appears in the
// public nav, so it MUST agree with BlockRenderer's DayOfTimelineBlock about what
// counts as content, otherwise a couple who adds a timeline and types nothing gets
// a Details tab in the nav that renders a blank section for guests.

const wedding = { scriptureText: null } as unknown as WeddingWebsite

function timelineBlock(contentJson: string): WeddingPageBlock {
  return {
    id: 'b1',
    weddingWebsiteId: 'w1',
    tab: 'DETAILS',
    type: 'DAY_OF_TIMELINE',
    sortOrder: 0,
    contentJson,
  }
}

const has = (contentJson: string) => blockHasContent(timelineBlock(contentJson), wedding, false, false)

describe('blockHasContent for DAY_OF_TIMELINE (issue #574)', () => {
  it('is content when at least one item has a time and a title', () => {
    expect(has(JSON.stringify({ items: [{ time: '3:00 PM', title: 'Ceremony begins', notes: '' }] }))).toBe(true)
  })

  it('is content when an item has only a title (couples often skip the time)', () => {
    expect(has(JSON.stringify({ items: [{ title: 'Send-off' }] }))).toBe(true)
  })

  it('is content when an item has only a time', () => {
    expect(has(JSON.stringify({ items: [{ time: '2:00 PM' }] }))).toBe(true)
  })

  it('counts a filled item even when blank rows sit around it', () => {
    const json = JSON.stringify({
      items: [{ time: '', title: '' }, { time: '4:00 PM', title: 'Reception' }, { time: '', title: '' }],
    })
    expect(has(json)).toBe(true)
  })

  it('is NOT content for an empty item list', () => {
    expect(has(JSON.stringify({ items: [] }))).toBe(false)
  })

  it('is NOT content for the default freshly added block (one blank row)', () => {
    expect(has(JSON.stringify({ items: [{ time: '', title: '', notes: '' }] }))).toBe(false)
  })

  it('is NOT content when rows hold only whitespace', () => {
    expect(has(JSON.stringify({ items: [{ time: '   ', title: '\t' }] }))).toBe(false)
  })

  it('is NOT content when notes are filled but the time and title are not', () => {
    expect(has(JSON.stringify({ items: [{ time: '', title: '', notes: 'wear comfortable shoes' }] }))).toBe(false)
  })

  it('survives malformed payloads without throwing', () => {
    expect(has('{}')).toBe(false)
    expect(has('not json at all')).toBe(false)
    expect(has(JSON.stringify({ items: 'nope' }))).toBe(false)
    expect(has(JSON.stringify({ items: [null, 7, 'x'] }))).toBe(false)
  })

  it('leaves the other block types alone', () => {
    const text = { ...timelineBlock(JSON.stringify({ markdown: 'hello' })), type: 'TEXT' as const }
    expect(blockHasContent(text, wedding, false, false)).toBe(true)
    const divider = { ...timelineBlock('{}'), type: 'DIVIDER' as const }
    expect(blockHasContent(divider, wedding, false, false)).toBe(false)
  })
})
