export interface WeddingWebsite {
  id: string
  slug: string
  isPublished: boolean
  partnerOneName: string
  partnerTwoName: string
  weddingDate: string | null
  heroPhotoUrl: string | null
  heroTagline: string | null
  ourStory: string | null
  scriptureReference: string | null
  scriptureText: string | null
  venueName: string | null
  venueAddress: string | null
  venueCity: string | null
  venueState: string | null
  ceremonyTime: string | null
  dressCode: string | null
  hotelName: string | null
  hotelUrl: string | null
  hotelDetails: string | null
  registryUrl1: string | null
  registryLabel1: string | null
  registryUrl2: string | null
  registryLabel2: string | null
  registryUrl3: string | null
  registryLabel3: string | null
  rsvpDeadline: string | null
  partnerOneVows: string | null
  partnerTwoVows: string | null
  // V34: opaque strings the couple set via the editor.
  //   hiddenTabs       = CSV of BlockTab enum names ("REGISTRY,TRAVEL")
  //   customTabLabels  = JSON map ({"TRAVEL":"Hotels & flights"})
  hiddenTabs: string | null
  customTabLabels: string | null
}

// Parsed view of the per-couple tab customisations. The raw fields above are
// opaque to the API; this helper turns them into typed structures the nav can use.
export interface TabCustomisation {
  hidden: Set<BlockTab>
  labels: Partial<Record<BlockTab, string>>
}

// Whitelist of valid BlockTab values. Used to reject garbage from the opaque
// hidden_tabs / custom_tab_labels columns: a future migration or hand-edit
// could leave stray strings, but the public nav should only ever recognise
// the eight known tabs.
const VALID_TABS: ReadonlySet<BlockTab> = new Set<BlockTab>([
  'HOME', 'OUR_STORY', 'DETAILS', 'WEDDING_PARTY',
  'REGISTRY', 'TRAVEL', 'PHOTOS', 'RSVP',
])

function isValidTab(v: string): v is BlockTab {
  return VALID_TABS.has(v as BlockTab)
}

export function parseTabCustomisation(wedding: Pick<WeddingWebsite, 'hiddenTabs' | 'customTabLabels'>): TabCustomisation {
  const hidden = new Set<BlockTab>()
  if (wedding.hiddenTabs) {
    for (const raw of wedding.hiddenTabs.split(',')) {
      const v = raw.trim()
      if (isValidTab(v)) hidden.add(v)
    }
  }
  const labels: Partial<Record<BlockTab, string>> = {}
  if (wedding.customTabLabels) {
    try {
      const parsed = JSON.parse(wedding.customTabLabels) as Record<string, string>
      for (const [k, v] of Object.entries(parsed)) {
        if (isValidTab(k) && typeof v === 'string' && v.trim()) {
          labels[k] = v.trim()
        }
      }
    } catch {
      // Malformed JSON from a corrupted save: fall back to defaults silently
      // rather than crash the public page render.
    }
  }
  return { hidden, labels }
}

export async function getWedding(slug: string): Promise<WeddingWebsite | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-websites/slug/${slug}`, { next: { revalidate: 60 } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  } catch {
    return null
  }
}

// ── Block types (mirrors frontend-app/src/features/couple/website/blocks/types.ts) ──

export type BlockTab =
  | 'HOME' | 'OUR_STORY' | 'DETAILS' | 'WEDDING_PARTY'
  | 'REGISTRY' | 'TRAVEL' | 'PHOTOS' | 'RSVP'

export type BlockType =
  | 'TEXT' | 'HEADING' | 'IMAGE' | 'STORY_ENTRY' | 'SCRIPTURE' | 'DIVIDER'
  | 'VENUE_CARD' | 'HOTEL_CARD' | 'REGISTRY_CARD'
  | 'COUNTDOWN' | 'RSVP_CTA'
  | 'WEDDING_PARTY_GRID' | 'PHOTO_ALBUM_GRID' | 'VOWS_PREVIEW'

export interface WeddingPageBlock {
  id: string
  weddingWebsiteId: string
  tab: BlockTab
  type: BlockType
  sortOrder: number
  contentJson: string
}

export async function getBlocks(slug: string, tab: BlockTab): Promise<WeddingPageBlock[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(
      `${apiUrl}/api/v1/wedding-page-blocks/slug/${slug}?tab=${tab}`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
