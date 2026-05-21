// Preview route: /preview/[slug]/[tab]
// Renders a block-driven preview of one tab for use in the SideBySideEditor iframe.
// Intentionally minimal chrome (no site header/footer, no hero) so the editor sees
// just the content area. Checkpoint 5 will add signed preview tokens for draft sites;
// for now we gate on isPublished just like the public wedding pages do.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// Preview routes are editor scaffolding rendered inside an iframe — not public content.
export const metadata: Metadata = { robots: { index: false, follow: false } }
import BlockRenderer, { WeddingPartyMember, WeddingPhoto } from '@/components/blocks/BlockRenderer'
import { getWedding, getBlocks, type BlockTab } from '@/app/wedding/[slug]/data'

const VALID_TABS = new Set([
  'HOME', 'OUR_STORY', 'DETAILS', 'WEDDING_PARTY',
  'REGISTRY', 'TRAVEL', 'PHOTOS', 'RSVP',
])

async function getPartyMembers(websiteId: string): Promise<WeddingPartyMember[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-party/website/${websiteId}`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

async function getPhotos(slug: string): Promise<WeddingPhoto[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://altarwed-prod-api.azurewebsites.net'
  try {
    const res = await fetch(`${apiUrl}/api/v1/wedding-photos/website/slug/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ slug: string; tab: string }>
}) {
  const { slug, tab: rawTab } = await params
  const tab = rawTab.toUpperCase()

  if (!VALID_TABS.has(tab)) notFound()

  const [wedding, blocks] = await Promise.all([
    getWedding(slug),
    getBlocks(slug, tab as BlockTab),
  ])

  // Gate on isPublished for now; Checkpoint 5 adds signed tokens for drafts.
  if (!wedding || !wedding.isPublished) notFound()

  // Eagerly fetch dynamic data only if the relevant block types are present in this tab.
  const needsParty = blocks.some(b => b.type === 'WEDDING_PARTY_GRID')
  const needsPhotos = blocks.some(b => b.type === 'PHOTO_ALBUM_GRID')

  const [partyMembers, photos] = await Promise.all([
    needsParty  ? getPartyMembers(wedding.id) : Promise.resolve([] as WeddingPartyMember[]),
    needsPhotos ? getPhotos(slug)             : Promise.resolve([] as WeddingPhoto[]),
  ])

  const tabLabel: Record<string, string> = {
    HOME: 'Home', OUR_STORY: 'Our Story', DETAILS: 'Details',
    WEDDING_PARTY: 'Wedding Party', REGISTRY: 'Registry',
    TRAVEL: 'Travel', PHOTOS: 'Photos', RSVP: 'RSVP',
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans text-[#3b2f2f]">
      {/* Minimal header — shows context without the full hero */}
      <header className="border-b border-[#e8dcc8] bg-white px-6 py-4">
        <p className="font-serif text-lg font-bold text-[#3b2f2f] leading-none">
          {wedding.partnerOneName} &amp; {wedding.partnerTwoName}
        </p>
        <p className="text-xs uppercase tracking-[0.2em] text-[#a08060] mt-0.5">
          Preview &mdash; {tabLabel[tab] ?? tab}
        </p>
      </header>

      {/* Block content */}
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {blocks.length === 0 ? (
          <p className="text-center text-[#a08060] text-sm py-16 italic">
            No blocks yet on this tab. Add blocks in the editor on the right.
          </p>
        ) : (
          blocks
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(block => (
              <BlockRenderer
                key={block.id}
                block={block}
                wedding={wedding}
                partyMembers={partyMembers}
                photos={photos}
              />
            ))
        )}
      </main>
    </div>
  )
}
