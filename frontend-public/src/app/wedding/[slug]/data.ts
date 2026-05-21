export interface WeddingWebsite {
  id: string
  slug: string
  isPublished: boolean
  partnerOneName: string
  partnerTwoName: string
  weddingDate: string | null
  heroPhotoUrl: string | null
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
  | 'TEXT' | 'HEADING' | 'IMAGE' | 'SCRIPTURE' | 'DIVIDER'
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
