import type { WeddingPartyMember, WeddingPhoto } from '@/components/blocks/BlockRenderer'

// Hard client-side timeout for every backend fetch on the public wedding render
// path. Without it a slow/wedged backend leaves the SSR render blocked until the
// Azure Static Web Apps gateway kills it with a hard 504.0 GatewayTimeout (the
// symptom a couple actually sees). With it, a timeout aborts the fetch: the
// content-presence gets (party/photos/blocks) fall through their catch to a safe
// default, and getWedding throws into wedding/error.tsx (a "try again" page) or
// keeps serving the last good ISR render, instead of a terminal gateway 504.
// Mirrors the same guard already in src/lib/sitemapData.ts (8s).
const FETCH_TIMEOUT_MS = 8000

export interface WeddingWebsite {
  id: string
  slug: string
  isPublished: boolean
  partnerOneName: string
  partnerTwoName: string
  weddingDate: string | null
  heroPhotoUrl: string | null
  heroTagline: string | null
  // V57: focal point for hero image (0.0–1.0). null = center (50% 50%).
  heroFocalPointX: number | null
  heroFocalPointY: number | null
  // V57: CSS color for tagline text. null = white.
  heroTaglineColor: string | null
  ourStory: string | null
  scriptureReference: string | null
  scriptureText: string | null
  // V57: translation code (e.g. "ESV"). null = unset.
  scriptureTranslation: string | null
  venueName: string | null
  venueAddress: string | null
  venueCity: string | null
  venueState: string | null
  ceremonyTime: string | null
  dressCode: string | null
  // V58: optional venue photo and additional info (parking, directions, etc.)
  venuePhotoUrl: string | null
  venueAdditionalInfo: string | null
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
  // V59: CSS accent color (e.g. "#d4af6a"). null = default gold.
  accentColor: string | null
  // V62: CSS color for the scripture banner background. null = default dark gradient.
  scriptureBackgroundColor: string | null
  // V90: reception venue (venueName etc. above are the ceremony venue) + optional
  // custom card titles. All null = no separate reception location.
  receptionVenueName: string | null
  receptionVenueAddress: string | null
  receptionVenueCity: string | null
  receptionVenueState: string | null
  receptionTime: string | null
  receptionVenueAdditionalInfo: string | null
  ceremonyVenueTitle: string | null
  receptionVenueTitle: string | null
  // V91: allowlisted font key for the couple's names. null = default serif.
  nameFont: string | null
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

// `fresh` bypasses the 60s ISR data cache. The public wedding page wants the
// cache (SEO/ISR per the SEO rules); the owner-only editor preview wants fresh
// data so a just-published site immediately drops its "Draft" banner instead of
// showing stale isPublished for up to 60s.
// fresh=true also switches to the /preview endpoint, which (unlike /slug) does not 404 an
// unpublished site: it is only ever called from the owner-only /preview/[slug]/[tab] route (#91).
export async function getWedding(slug: string, fresh = false): Promise<WeddingWebsite | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  const path = fresh ? `preview/${slug}` : `slug/${slug}`
  const res = await fetch(`${apiUrl}/api/v1/wedding-websites/${path}`,
    fresh
      ? { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
      : { next: { revalidate: 60 }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  // Only a genuine 404 means the site does not exist; the caller turns that into
  // notFound(). Every other failure (5xx, network, timeout, malformed body) is
  // transient and MUST throw rather than return null (issue #148). Returning null
  // here previously conflated "backend is briefly down" with "this wedding does
  // not exist", so a cold-cache render during an outage burned a false 404 onto
  // the platform's core SEO/ad-landing surface. Letting it throw means that on a
  // warm ISR cache Next keeps serving the last good render (stale-while-revalidate,
  // the common case once a slug has been hit), and on a cold cache the throw is
  // caught by the wedding/error.tsx boundary (a "temporary trouble, try again"
  // page), instead of the terminal "this wedding doesn't exist" page.
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// Lightweight content-presence checks used to gate the Wedding Party and Photos
// tabs in the layout/home grid. They hit the exact same public endpoints the
// /wedding-party and /photos pages render from, so a tab only shows when its page
// would actually have content. Without this, a typical half-filled couple ships a
// public site (the surface paid ads land on) with dead "coming soon" tabs.
// Cached with the same 60s ISR window as the rest of the wedding page.
export async function hasWeddingPartyMembers(websiteId: string): Promise<boolean> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-party/website/${websiteId}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return false
    const members = await res.json()
    // Mirror the wedding-party page exactly: it only renders BRIDE/GROOM groups
    // and shows "coming soon" when both are empty. A couple who has only NEUTRAL
    // members (officiant, musicians) would otherwise re-open the dead tab this
    // gate exists to hide.
    return Array.isArray(members) && members.some((m: { side?: string }) => m.side === 'BRIDE' || m.side === 'GROOM')
  } catch {
    return false
  }
}

export async function hasWeddingPhotos(slug: string): Promise<boolean> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-photos/website/slug/${slug}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return false
    const photos = await res.json()
    return Array.isArray(photos) && photos.length > 0
  } catch {
    return false
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

// fresh=true switches to the /preview endpoint (same rationale as getWedding above).
export async function getBlocks(slug: string, tab: BlockTab, fresh = false): Promise<WeddingPageBlock[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const path = fresh ? `preview/${slug}` : `slug/${slug}`
    const res = await fetch(
      `${apiUrl}/api/v1/wedding-page-blocks/${path}?tab=${tab}`,
      fresh
        ? { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
        : { next: { revalidate: 60 }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// All blocks across every tab for a site (no tab filter). Used by the layout to
// decide which nav tabs have block-backed content, not just scalar content.
export async function getAllBlocks(slug: string): Promise<WeddingPageBlock[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-page-blocks/slug/${slug}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// Party members + photos for the dynamic grid blocks on the PUBLIC site (60s ISR,
// unlike the preview which fetches them no-store). Typed against BlockRenderer's
// shapes so they drop straight into <BlockRenderer>.
export async function getPartyMembers(websiteId: string): Promise<WeddingPartyMember[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-party/website/${websiteId}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function getPhotos(slug: string): Promise<WeddingPhoto[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-photos/website/slug/${slug}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// True when a block will render visible content for a guest. Mirrors the null /
// empty-state returns in BlockRenderer so a tab holding only empty blocks is
// treated as having no content (it falls back to the scalar template and stays
// out of the nav) rather than showing a blank section.
export function blockHasContent(
  block: WeddingPageBlock,
  wedding: WeddingWebsite,
  hasPartyMembers: boolean,
  hasPhotosPresent: boolean,
): boolean {
  let c: Record<string, unknown> = {}
  try { c = JSON.parse(block.contentJson) } catch { c = {} }
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  switch (block.type) {
    case 'TEXT': return !!s(c.markdown)
    case 'HEADING': return !!s(c.text)
    case 'IMAGE': return !!s(c.url)
    case 'STORY_ENTRY': return !!(s(c.body) || s(c.imageUrl) || s(c.dateLabel))
    case 'SCRIPTURE': {
      // Mirror BlockRenderer's HOME pinned-verse suppression (BlockRenderer.tsx
      // SCRIPTURE case): a HOME scripture block that only repeats the layout's
      // pinned verse renders null there, so it is NOT content. Older sites were
      // backfill-seeded exactly this block; without this guard a couple whose only
      // HOME block is that verse would skip the scalar fallback and render a blank
      // home body. Keep this in sync with BlockRenderer's null-returns.
      const text = s(c.text)
      const pinned = (wedding.scriptureText ?? '').trim()
      if (block.tab === 'HOME' && pinned && text === pinned) return false
      return !!(text || s(c.reference))
    }
    case 'RSVP_CTA': return true
    case 'COUNTDOWN': return !!wedding.weddingDate
    case 'VENUE_CARD': {
      // A reception-slot card has content only when the reception venue is set;
      // a ceremony/legacy card gates on the ceremony venue.
      const venueSlot = s(c.venueSlot)
      return venueSlot === 'RECEPTION' ? !!wedding.receptionVenueName : !!wedding.venueName
    }
    case 'HOTEL_CARD': return !!wedding.hotelName
    case 'REGISTRY_CARD': {
      const slot = typeof c.slot === 'number' ? c.slot : 1
      const url = slot === 1 ? wedding.registryUrl1 : slot === 2 ? wedding.registryUrl2 : wedding.registryUrl3
      return !!url
    }
    case 'WEDDING_PARTY_GRID': return hasPartyMembers
    case 'PHOTO_ALBUM_GRID': return hasPhotosPresent
    case 'VOWS_PREVIEW': return !!(wedding.partnerOneVows || wedding.partnerTwoVows)
    case 'DIVIDER': return false
    default: return false
  }
}

// Set of tabs with at least one content-bearing block. The layout ORs this with
// the scalar-content flags so a tab a couple filled only via the block editor
// (e.g. a STORY_ENTRY with no legacy ourStory scalar) still appears in the nav.
export function computeTabsWithContent(
  blocks: WeddingPageBlock[],
  wedding: WeddingWebsite,
  hasPartyMembers: boolean,
  hasPhotosPresent: boolean,
): Set<BlockTab> {
  const set = new Set<BlockTab>()
  for (const b of blocks) {
    if (blockHasContent(b, wedding, hasPartyMembers, hasPhotosPresent)) set.add(b.tab)
  }
  return set
}
