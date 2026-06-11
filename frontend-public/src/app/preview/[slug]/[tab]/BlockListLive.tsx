'use client'

// BlockListLive, client wrapper around BlockRenderer that listens for
// `blocks-update` postMessage events from the SideBySideEditor.
//
// Why: every keystroke in the editor used to bump the iframe key, forcing a
// full Next.js SSR refetch (~500-1500ms). At the scale of "couple types a
// paragraph", that's hundreds of reloads. The pattern used by The Knot,
// Squarespace, Webflow and WordPress Gutenberg is to keep the preview frame
// mounted and patch the rendered tree from a message channel. We do the same
// here, the iframe hydrates once from server props, then takes block updates
// over postMessage until the user changes tab or triggers a true reload (hero
// photo upload, publish toggle).
//
// Origin check: messages must come from this preview's parent origin (the
// frontend-app dashboard). Anything else is discarded silently.

import { useEffect, useState } from 'react'
import BlockRenderer, { type WeddingPartyMember, type WeddingPhoto } from '@/components/blocks/BlockRenderer'
import type { WeddingPageBlock, WeddingWebsite } from '@/app/wedding/[slug]/data'

interface Props {
  initialBlocks: WeddingPageBlock[]
  wedding: WeddingWebsite
  partyMembers: WeddingPartyMember[]
  photos: WeddingPhoto[]
}

interface BlocksUpdateMessage {
  type: 'blocks-update'
  blocks: WeddingPageBlock[]
}

function isBlocksUpdate(d: unknown): d is BlocksUpdateMessage {
  if (!d || typeof d !== 'object') return false
  const m = d as Record<string, unknown>
  return m.type === 'blocks-update' && Array.isArray(m.blocks)
}

export default function BlockListLive({ initialBlocks, wedding, partyMembers, photos }: Props) {
  const [blocks, setBlocks] = useState(initialBlocks)

  // Re-hydrate from server props when they change (happens on tab switch,
  // hero photo upload, or publish toggle, anything that re-mounts the iframe).
  useEffect(() => {
    setBlocks(initialBlocks)
  }, [initialBlocks])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!isBlocksUpdate(e.data)) return
      setBlocks(e.data.blocks)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  if (blocks.length === 0) {
    return (
      <div className="text-center text-[#8a6a4a] text-sm py-16 italic border-2 border-dashed border-[#e8dcc8] rounded-xl">
        <p>This tab is empty.</p>
        <p className="mt-1 text-xs">Add blocks on the right to see them appear here.</p>
      </div>
    )
  }

  return (
    <>
      {[...blocks]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(block => (
          <BlockRenderer
            key={block.id}
            block={block}
            wedding={wedding}
            partyMembers={partyMembers}
            photos={photos}
            preview
          />
        ))}
    </>
  )
}
