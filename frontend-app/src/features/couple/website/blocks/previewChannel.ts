// Message contract for the editor -> preview-iframe postMessage channel
// (issue #310). The preview side of this contract lives in
// frontend-public/src/app/preview/[slug]/[tab]/previewMessages.ts.
// The two workspaces do not share a package, so the contract is duplicated;
// keep both files (and their unit tests) in sync when it changes.
//
// Message types:
//   editor -> preview
//     'tab-switch'        ask the preview to swap the visible tab client-side
//                         (no iframe remount, no full document reload)
//     'blocks-update'     push the current tab's blocks (existing live channel,
//                         now tagged with the tab so a preview mid-navigation
//                         can drop updates meant for a different tab)
//   preview -> editor
//     'tab-switch-ack'    the preview received 'tab-switch' and will navigate;
//                         cancels the editor's reload fallback
//     'preview-tab-ready' a preview document for the given tab mounted and is
//                         listening; the editor resends the latest blocks so
//                         edits made while navigation was in flight are shown

import type { BlockTab, WeddingPageBlock } from './types'

// How long the editor waits for a 'tab-switch-ack' before falling back to a
// full iframe reload. The ack is sent synchronously on message receipt (no
// network hop), so a healthy preview answers in single-digit milliseconds;
// the timeout only fires against an old preview deploy that predates the
// tab-switch contract, or an iframe that failed to load.
export const TAB_SWITCH_ACK_TIMEOUT_MS = 1000

// Normalize a base URL to its origin for MessageEvent.origin comparison.
// e.origin is always scheme://host[:port] with no path or trailing slash, so a
// configured base URL like "https://www.altarwed.com/" must be reduced to its
// origin or the strict equality check would never match.
export function originOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin
  } catch {
    return baseUrl
  }
}

export function makeTabSwitchMessage(tab: BlockTab) {
  return { type: 'tab-switch', tab } as const
}

export function makeBlocksUpdateMessage(tab: BlockTab, blocks: WeddingPageBlock[]) {
  return { type: 'blocks-update', tab, blocks } as const
}

function hasTypeAndTab(data: unknown, type: string, tab: BlockTab): boolean {
  if (!data || typeof data !== 'object') return false
  const m = data as Record<string, unknown>
  return m.type === type && m.tab === tab
}

// True when `data` is the preview's ack for the specific tab we asked for.
// Acks for a different tab (a stale answer after a rapid double tab click)
// must not cancel the newer pending switch's fallback timer.
export function isTabSwitchAck(data: unknown, tab: BlockTab): boolean {
  return hasTypeAndTab(data, 'tab-switch-ack', tab)
}

// True when `data` announces that the preview document for `tab` just mounted.
export function isPreviewTabReady(data: unknown, tab: BlockTab): boolean {
  return hasTypeAndTab(data, 'preview-tab-ready', tab)
}
