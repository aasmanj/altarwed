// Shared types and helpers for the DAY_OF_TIMELINE block.
// Used by BlockRenderer (rendering) and blockHasContent in data.ts (nav gating).
// A single copy here prevents the two from silently diverging: if blockHasContent
// says there is content but parseTimelineItems returns nothing, the Details tab
// appears in the nav and guests land on a blank section.

export interface TimelineItem {
  time: string
  title: string
  notes: string
}

// contentJson is opaque to the backend (no server-side validation of the row
// shape), so treat every field as untrusted. Trims whitespace, then drops rows
// with neither a time nor a title: the editor seeds a new block with one blank
// row, and a guest should never see an empty line on the public site.
export function parseTimelineItems(raw: unknown): TimelineItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(entry => {
      const row = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      const s = (k: string) => (typeof row[k] === 'string' ? (row[k] as string).trim() : '')
      return { time: s('time'), title: s('title'), notes: s('notes') }
    })
    .filter(item => item.time || item.title)
}
