// Mirrors backend BlockTab + BlockType enums. Keep in sync with
// backend/src/main/java/com/altarwed/domain/model/BlockTab.java + BlockType.java.

export const BLOCK_TABS = [
  'HOME',
  'OUR_STORY',
  'DETAILS',
  'WEDDING_PARTY',
  'REGISTRY',
  'TRAVEL',
  'PHOTOS',
  'RSVP',
] as const

export type BlockTab = (typeof BLOCK_TABS)[number]

export const BLOCK_TAB_LABELS: Record<BlockTab, string> = {
  HOME: 'Home',
  OUR_STORY: 'Our Story',
  DETAILS: 'Details',
  WEDDING_PARTY: 'Wedding Party',
  REGISTRY: 'Registry',
  TRAVEL: 'Travel',
  PHOTOS: 'Photos',
  RSVP: 'RSVP',
}

export const BLOCK_TYPES = [
  'TEXT',
  'HEADING',
  'IMAGE',
  'STORY_ENTRY',
  'SCRIPTURE',
  'DIVIDER',
  'VENUE_CARD',
  'HOTEL_CARD',
  'REGISTRY_CARD',
  'COUNTDOWN',
  'RSVP_CTA',
  'WEDDING_PARTY_GRID',
  'PHOTO_ALBUM_GRID',
  'VOWS_PREVIEW',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  TEXT: 'Text paragraph',
  HEADING: 'Heading',
  IMAGE: 'Image',
  STORY_ENTRY: 'Story moment (text + photo)',
  SCRIPTURE: 'Scripture verse',
  DIVIDER: 'Divider',
  VENUE_CARD: 'Venue card',
  HOTEL_CARD: 'Hotel card',
  REGISTRY_CARD: 'Registry card',
  COUNTDOWN: 'Countdown',
  RSVP_CTA: 'RSVP call-to-action',
  WEDDING_PARTY_GRID: 'Wedding party grid',
  PHOTO_ALBUM_GRID: 'Photo album',
  VOWS_PREVIEW: 'Vows preview',
}

// Which block types each tab is allowed to add. Keeps the editor coherent —
// e.g. you can't drop a HOTEL_CARD on the RSVP tab.
export const ALLOWED_TYPES_PER_TAB: Record<BlockTab, BlockType[]> = {
  HOME: ['HEADING', 'TEXT', 'IMAGE', 'SCRIPTURE', 'DIVIDER', 'COUNTDOWN', 'RSVP_CTA'],
  OUR_STORY: ['STORY_ENTRY', 'HEADING', 'TEXT', 'IMAGE', 'SCRIPTURE', 'DIVIDER'],
  DETAILS: ['HEADING', 'TEXT', 'IMAGE', 'SCRIPTURE', 'DIVIDER', 'VENUE_CARD'],
  WEDDING_PARTY: ['HEADING', 'TEXT', 'DIVIDER', 'WEDDING_PARTY_GRID'],
  REGISTRY: ['HEADING', 'TEXT', 'DIVIDER', 'REGISTRY_CARD'],
  TRAVEL: ['HEADING', 'TEXT', 'IMAGE', 'DIVIDER', 'HOTEL_CARD'],
  PHOTOS: ['HEADING', 'TEXT', 'DIVIDER', 'PHOTO_ALBUM_GRID'],
  RSVP: ['HEADING', 'TEXT', 'DIVIDER', 'RSVP_CTA', 'COUNTDOWN'],
}

export interface WeddingPageBlock {
  id: string
  weddingWebsiteId: string
  tab: BlockTab
  type: BlockType
  sortOrder: number
  contentJson: string
  createdAt: string
  updatedAt: string
}

// Default contentJson string for each block type — used when adding a new block.
export function defaultContentJson(type: BlockType): string {
  switch (type) {
    case 'TEXT':
      return JSON.stringify({ markdown: '' })
    case 'HEADING':
      return JSON.stringify({ text: 'New heading', level: 2 })
    case 'IMAGE':
      return JSON.stringify({ url: '', caption: '', alt: '' })
    case 'STORY_ENTRY':
      return JSON.stringify({ dateLabel: '', body: '', imageUrl: '', imagePosition: 'right' })
    case 'SCRIPTURE':
      return JSON.stringify({ reference: '', text: '', translation: 'ESV' })
    case 'REGISTRY_CARD':
      return JSON.stringify({ slot: 1 })
    case 'WEDDING_PARTY_GRID':
      return JSON.stringify({ side: 'BRIDE' })
    default:
      // DIVIDER, VENUE_CARD, HOTEL_CARD, COUNTDOWN, RSVP_CTA, PHOTO_ALBUM_GRID,
      // VOWS_PREVIEW — payload pulled from the website's scalar fields at render time.
      return '{}'
  }
}
