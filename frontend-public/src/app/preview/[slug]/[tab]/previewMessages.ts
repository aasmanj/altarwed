// Message contract for the editor -> preview-iframe postMessage channel
// (issue #310). The editor side of this contract lives in
// frontend-app/src/features/couple/website/blocks/previewChannel.ts.
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

import type { BlockTab, WeddingPageBlock } from '@/app/wedding/[slug]/data'

// Origins allowed to send messages into this preview iframe. Mirrors
// HeroLive.tsx's whitelist: the dashboard editor lives at app.altarwed.com in
// prod and on localhost during dev. Any postMessage from a different origin
// is ignored -- postMessage is fundamentally cross-origin and this route is
// embedded (as an iframe) from a different origin (frontend-app).
export const EDITOR_ORIGINS = [
  'https://app.altarwed.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

// Kept in sync with BlockTab in @/app/wedding/[slug]/data. Duplicated locally
// (as a runtime value, not just a type) so an incoming postMessage payload can
// be validated against a real whitelist instead of trusting the string a
// cross-origin sender claims -- a malformed or malicious 'tab' must never
// reach router.push.
const VALID_TABS: ReadonlySet<BlockTab> = new Set<BlockTab>([
  'HOME', 'OUR_STORY', 'DETAILS', 'WEDDING_PARTY',
  'REGISTRY', 'TRAVEL', 'PHOTOS', 'RSVP',
])

function isValidTab(v: unknown): v is BlockTab {
  return typeof v === 'string' && VALID_TABS.has(v as BlockTab)
}

// Returns the requested tab if `data` is a well-formed 'tab-switch' message,
// or null otherwise (wrong type, missing tab, or a tab outside the whitelist).
export function parseTabSwitch(data: unknown): BlockTab | null {
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (m.type !== 'tab-switch') return null
  return isValidTab(m.tab) ? m.tab : null
}

export function makeTabSwitchAckMessage(tab: BlockTab) {
  return { type: 'tab-switch-ack', tab } as const
}

export function makePreviewTabReadyMessage(tab: BlockTab) {
  return { type: 'preview-tab-ready', tab } as const
}

// True when `data` is a 'blocks-update' message tagged for `tab`. Tagged so a
// preview mid client-side navigation between tabs drops an update meant for
// the tab it is navigating away from instead of flashing it briefly before
// the swap completes.
export function parseBlocksUpdate(data: unknown, tab: BlockTab): WeddingPageBlock[] | null {
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (m.type !== 'blocks-update' || m.tab !== tab || !Array.isArray(m.blocks)) return null
  return m.blocks as WeddingPageBlock[]
}
