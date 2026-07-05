'use client'

// TabSwitchListener: preview side of the editor <-> preview-iframe postMessage
// tab-switch contract (issue #310). Message shapes live in previewMessages.ts;
// this component is the only thing in the preview that speaks that half of the
// contract.
//
// Why: every tab click in SideBySideEditor used to bump the iframe's key,
// forcing a full Next.js SSR round trip (white flash + spinner) on the
// editor's most-clicked control. Instead the editor postMessages a
// 'tab-switch' and this component performs a client-side (RSC) navigation via
// Next's router, no full document reload, no iframe remount.
//
// Flow:
//   1. 'tab-switch' arrives from an allowed origin -> ack immediately
//      (synchronous, no network hop) so the editor's 1s reload-fallback timer
//      never fires against a healthy preview, then router.push to the
//      requested tab's route.
//   2. Once Next has fetched the new tab's data and this component re-renders
//      with the new `tab` prop, announce 'preview-tab-ready' so the editor
//      resends the latest blocks (covers edits made mid-navigation). The full
//      iframe-reload path (template change, publish, manual refresh) already
//      resends blocks on iframe onLoad, so this is skipped when no editor
//      origin has been observed yet (nothing to reply to).
//
// Origin check: as strict as HeroLive/BlockListLive -- only EDITOR_ORIGINS may
// trigger a switch, and every outgoing reply targets the exact origin the
// triggering message came from (never a wildcard '*' targetOrigin).

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { BlockTab } from '@/app/wedding/[slug]/data'
import {
  EDITOR_ORIGINS,
  parseTabSwitch,
  makeTabSwitchAckMessage,
  makePreviewTabReadyMessage,
} from './previewMessages'

interface Props {
  slug: string
  tab: BlockTab
}

export default function TabSwitchListener({ slug, tab }: Props) {
  const router = useRouter()
  // Origin of the editor window, learned the first time it messages us.
  // Used only as a postMessage targetOrigin (never to decide what to accept);
  // acks are also sent straight back to the verified e.origin of the message
  // that triggered them.
  const editorOriginRef = useRef<string | null>(null)
  // The tab we've already announced 'preview-tab-ready' for, so a re-render
  // that does not change the tab (e.g. a sibling prop update) does not
  // re-announce.
  const readyAnnouncedForRef = useRef<BlockTab | null>(null)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!EDITOR_ORIGINS.includes(e.origin)) return
      const requestedTab = parseTabSwitch(e.data)
      if (!requestedTab) return
      editorOriginRef.current = e.origin
      // Ack unconditionally, even a same-tab request: the ack is what cancels
      // the editor's reload fallback timer, and a rapid double click on the
      // active tab should not fall through to a full reload either. Reply
      // straight back to the verified e.origin, never a wildcard.
      window.parent.postMessage(makeTabSwitchAckMessage(requestedTab), e.origin)
      if (requestedTab === tab) return
      router.push(`/preview/${slug}/${requestedTab.toLowerCase()}`)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [router, slug, tab])

  useEffect(() => {
    if (readyAnnouncedForRef.current === tab) return
    readyAnnouncedForRef.current = tab
    const origin = editorOriginRef.current
    if (!origin) return
    window.parent.postMessage(makePreviewTabReadyMessage(tab), origin)
  }, [tab])

  return null
}
