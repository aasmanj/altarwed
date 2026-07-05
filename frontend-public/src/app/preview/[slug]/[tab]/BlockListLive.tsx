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
// Origin check: messages must come from an allowed editor origin (the
// frontend-app dashboard, see EDITOR_ORIGINS in previewMessages.ts). Anything
// else is discarded silently.
//
// Tab tagging (issue #310): 'blocks-update' messages now carry the tab they
// are for. A client-side tab-switch navigation (TabSwitchListener) can leave
// this component mounted for a brief moment while the new tab's data is still
// in flight; without the tag a stale update meant for the tab we're
// navigating away from could flash in right before the swap completes.

import { useEffect, useState } from 'react'
import BlockRenderer, { type WeddingPartyMember, type WeddingPhoto } from '@/components/blocks/BlockRenderer'
import type { BlockTab, WeddingPageBlock, WeddingWebsite } from '@/app/wedding/[slug]/data'
import { EDITOR_ORIGINS, parseBlocksUpdate } from './previewMessages'

interface Props {
  tab: BlockTab
  initialBlocks: WeddingPageBlock[]
  wedding: WeddingWebsite
  partyMembers: WeddingPartyMember[]
  photos: WeddingPhoto[]
}

export default function BlockListLive({ tab, initialBlocks, wedding, partyMembers, photos }: Props) {
  const [blocks, setBlocks] = useState(initialBlocks)

  // Re-hydrate from server props when they change (happens on a tab switch's
  // client-side navigation, hero photo upload, publish toggle, anything that
  // re-renders/re-mounts this component with fresh server-fetched blocks).
  useEffect(() => {
    setBlocks(initialBlocks)
  }, [initialBlocks])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!EDITOR_ORIGINS.includes(e.origin)) return
      const updated = parseBlocksUpdate(e.data, tab)
      if (!updated) return
      setBlocks(updated)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [tab])

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
