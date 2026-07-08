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
  STORY_ENTRY: 'Story moment',
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

// One-sentence descriptions for the block picker. Couples (especially older
// guests doing a walkthrough) don't know what "VENUE_CARD" means: these
// disambiguate. Kept under ~90 chars each so they wrap to one line in the picker.
export const BLOCK_TYPE_DESCRIPTIONS: Record<BlockType, string> = {
  TEXT:               'A paragraph of plain text. Use for greetings, notes, or anything narrative.',
  HEADING:            'A bold section title (large, medium, or small).',
  IMAGE:              'A standalone photo with optional caption.',
  STORY_ENTRY:        'A single memory or milestone in your love story. Use a label like "The Proposal" or just a date.',
  SCRIPTURE:          'A verse with reference and translation. Edit all three fields right here in the block.',
  DIVIDER:            'A decorative gold line to separate sections.',
  VENUE_CARD:         'Ceremony venue with address, time, and dress code. Edit details on the Details tab.',
  HOTEL_CARD:         'Hotel block(s) for out-of-town guests. Add hotels on the Travel tab.',
  REGISTRY_CARD:      'A single registry button (Amazon, Target, etc). Manage links via this section\'s edit button.',
  COUNTDOWN:          'Live countdown to your wedding date.',
  RSVP_CTA:           'A "Will you join us?" callout with a button linking to the RSVP page.',
  WEDDING_PARTY_GRID: 'Photo grid of wedding party members for one side (bride or groom).',
  PHOTO_ALBUM_GRID:   'All photos uploaded to the Photos page in a flowing gallery.',
  VOWS_PREVIEW:       'Side-by-side preview of both partners’ vows (visible to guests after publishing).',
}

// Which block types each tab is allowed to add. Keeps the editor coherent  
// e.g. you can't drop a HOTEL_CARD on the RSVP tab.
export const ALLOWED_TYPES_PER_TAB: Record<BlockTab, BlockType[]> = {
  // Issue #329: the Home landing view is trimmed to functional/venue blocks only.
  // Generic content primitives (HEADING, TEXT, SCRIPTURE, DIVIDER) belong on
  // Our Story / Details, not the landing view. VENUE_CARD surfaces the date/venue
  // summary to guests by default. This gates ADDING blocks only; existing Home
  // blocks of the dropped types on already-built sites still render.
  HOME: ['IMAGE', 'VENUE_CARD', 'COUNTDOWN', 'RSVP_CTA'],
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

// Default contentJson string for each block type: used when adding a new block.
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
      // VOWS_PREVIEW: payload pulled from the website's scalar fields at render time.
      return '{}'
  }
}
