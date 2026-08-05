import { describe, it, expect } from 'vitest'
import {
  ALLOWED_TYPES_PER_TAB,
  BLOCK_TYPES,
  BLOCK_TYPE_DESCRIPTIONS,
  BLOCK_TYPE_LABELS,
  defaultContentJson,
} from './types'
import { parseTimelineItems, EMPTY_TIMELINE_ITEM } from './BlockForm'

// Issue #574: the day-of timeline block. The picker reads BLOCK_TYPES /
// ALLOWED_TYPES_PER_TAB and the "Add block" flow seeds contentJson from
// defaultContentJson, so pinning those is the behavioral guard for the editor
// half of the feature.

describe('DAY_OF_TIMELINE block registration (issue #574)', () => {
  it('is offered by the picker with a label and a description', () => {
    expect(BLOCK_TYPES).toContain('DAY_OF_TIMELINE')
    expect(BLOCK_TYPE_LABELS.DAY_OF_TIMELINE).toBeTruthy()
    expect(BLOCK_TYPE_DESCRIPTIONS.DAY_OF_TIMELINE).toBeTruthy()
  })

  it('is addable on the Details tab only', () => {
    expect(ALLOWED_TYPES_PER_TAB.DETAILS).toContain('DAY_OF_TIMELINE')
    for (const [tab, types] of Object.entries(ALLOWED_TYPES_PER_TAB)) {
      if (tab !== 'DETAILS') expect(types).not.toContain('DAY_OF_TIMELINE')
    }
  })

  it('seeds a new block with exactly one blank row', () => {
    expect(JSON.parse(defaultContentJson('DAY_OF_TIMELINE'))).toEqual({
      items: [{ time: '', title: '', notes: '' }],
    })
  })

  it('leaves the other block types default payloads untouched', () => {
    expect(JSON.parse(defaultContentJson('HEADING'))).toEqual({ text: 'New heading', level: 2 })
    expect(defaultContentJson('DIVIDER')).toBe('{}')
    expect(JSON.parse(defaultContentJson('VENUE_CARD'))).toEqual({ venueSlot: 'CEREMONY' })
  })
})

describe('parseTimelineItems', () => {
  it('keeps well-formed rows in order', () => {
    expect(parseTimelineItems([
      { time: '2:00 PM', title: 'Doors open', notes: '' },
      { time: '3:00 PM', title: 'Ceremony begins', notes: 'First Baptist Church' },
    ])).toEqual([
      { time: '2:00 PM', title: 'Doors open', notes: '' },
      { time: '3:00 PM', title: 'Ceremony begins', notes: 'First Baptist Church' },
    ])
  })

  it('fills missing fields rather than yielding undefined into a controlled input', () => {
    expect(parseTimelineItems([{ title: 'Send-off' }])).toEqual([
      { time: '', title: 'Send-off', notes: '' },
    ])
  })

  it('coerces non-string field values to empty strings', () => {
    expect(parseTimelineItems([{ time: 1500, title: null, notes: { a: 1 } }])).toEqual([
      EMPTY_TIMELINE_ITEM,
    ])
  })

  it('returns an empty list for anything that is not an array', () => {
    expect(parseTimelineItems(undefined)).toEqual([])
    expect(parseTimelineItems(null)).toEqual([])
    expect(parseTimelineItems('items')).toEqual([])
    expect(parseTimelineItems({ items: [] })).toEqual([])
  })

  it('survives null and primitive entries inside the array', () => {
    expect(parseTimelineItems([null, 7, 'x'])).toEqual([
      EMPTY_TIMELINE_ITEM,
      EMPTY_TIMELINE_ITEM,
      EMPTY_TIMELINE_ITEM,
    ])
  })
})
