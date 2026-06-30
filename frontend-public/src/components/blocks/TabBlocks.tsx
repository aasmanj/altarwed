import type { ReactNode } from 'react'
import BlockRenderer, { type WeddingPartyMember, type WeddingPhoto } from './BlockRenderer'
import {
  getBlocks,
  getPartyMembers,
  getPhotos,
  blockHasContent,
  type BlockTab,
  type WeddingWebsite,
} from '@/app/wedding/[slug]/data'

// Renders one tab's blocks (the couple's WYSIWYG content from the editor) on the
// LIVE public site, the same content the /preview route shows. Falls back to the
// legacy scalar template when the tab has no content-bearing blocks, so older
// scalar-only sites keep working unchanged.
//
// Server component: getBlocks is 60s-ISR-cached, so SSR/SEO are preserved. Party
// members and photos are fetched only when a grid block on this tab needs them.
export default async function TabBlocks({
  slug,
  tab,
  wedding,
  fallback,
}: {
  slug: string
  tab: BlockTab
  wedding: WeddingWebsite
  fallback: ReactNode
}) {
  const blocks = (await getBlocks(slug, tab)).slice().sort((a, b) => a.sortOrder - b.sortOrder)

  const needParty = blocks.some(b => b.type === 'WEDDING_PARTY_GRID')
  const needPhotos = blocks.some(b => b.type === 'PHOTO_ALBUM_GRID')
  const [party, photos] = await Promise.all([
    needParty ? getPartyMembers(wedding.id) : Promise.resolve([] as WeddingPartyMember[]),
    needPhotos ? getPhotos(slug) : Promise.resolve([] as WeddingPhoto[]),
  ])

  // If nothing on this tab would actually render (all blocks empty, or no blocks
  // at all), show the scalar template instead of a blank section.
  const hasContent = blocks.some(b => blockHasContent(b, wedding, party.length > 0, photos.length > 0))
  if (!hasContent) return <>{fallback}</>

  return (
    <div className="space-y-8">
      {blocks.map(b => (
        <BlockRenderer key={b.id} block={b} wedding={wedding} partyMembers={party} photos={photos} />
      ))}
    </div>
  )
}
