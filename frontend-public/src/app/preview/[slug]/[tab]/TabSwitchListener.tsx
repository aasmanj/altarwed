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
//
// Origin persistence: editorOriginRef is backed by sessionStorage
// (editorOriginStorage.ts), not a plain ref alone. See that file's header
// comment for why: a component remount on tab switch would otherwise reset
// the ref to null and silently disable the ready-announce below for the rest
// of the session. readyAnnouncedForRef does NOT need the same treatment --
// it dedupes against the `tab` prop, which is always fresh on every render
// (including a fresh mount after a remount), so the worst case of a remount
// resetting it is one redundant 'preview-tab-ready' announce, not a
// permanently disabled mechanism.

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { BlockTab } from '@/app/wedding/[slug]/data'
import {
  EDITOR_ORIGINS,
  parseTabSwitch,
  makeTabSwitchAckMessage,
  makePreviewTabReadyMessage,
} from './previewMessages'
import { readStoredEditorOrigin, storeEditorOrigin } from './editorOriginStorage'

interface Props {
  slug: string
  tab: BlockTab
}

export default function TabSwitchListener({ slug, tab }: Props) {
  const router = useRouter()
  // Origin of the editor window, learned the first time it messages us.
  // Used only as a postMessage targetOrigin (never to decide what to accept);
  // acks are also sent straight back to the verified e.origin of the message
  // that triggered them. Seeded from sessionStorage on init (not just null)
  // so a remounted instance recovers an origin learned by a prior instance
  // in this same browsing session.
  const editorOriginRef = useRef<string | null>(null)
  if (editorOriginRef.current === null) {
    editorOriginRef.current = readStoredEditorOrigin()
  }
  // The tab we've already announced 'preview-tab-ready' for, so a re-render
  // that does not change the tab (e.g. a sibling prop update) does not
  // re-announce.
  const readyAnnouncedForRef = useRef<BlockTab | null>(null)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!EDITOR_ORIGINS.includes(e.origin)) return
      const request = parseTabSwitch(e.data)
      if (!request) return
      const { tab: requestedTab, switchId } = request
      editorOriginRef.current = e.origin
      storeEditorOrigin(e.origin)
      // Ack unconditionally, even a same-tab request: the ack is what cancels
      // the editor's reload fallback timer, and a rapid double click on the
      // active tab should not fall through to a full reload either. Reply
      // straight back to the verified e.origin, never a wildcard. Echoing
      // switchId back lets the editor tell this ack apart from a stale ack
      // for a superseded request to the same tab.
      window.parent.postMessage(makeTabSwitchAckMessage(requestedTab, switchId), e.origin)
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
