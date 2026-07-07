// Persists the editor origin learned by TabSwitchListener across a possible
// component remount on client-side navigation (issue #310 follow-up).
//
// Why this exists: there is no layout.tsx under app/preview/, so
// TabSwitchListener is rendered by the leaf page.tsx directly. Whether Next's
// App Router preserves a client component's identity (and its plain useRefs)
// across a soft navigation to a different value of the same dynamic segment
// is version-sensitive. If the component instance is destroyed and recreated
// on a tab switch, a plain `useRef<string | null>(null)` resets to null, and
// 'preview-tab-ready' (which requires a known origin to reply to) silently
// stops firing after the first tab-switch message -- permanently disabling
// the "resend blocks edited mid-navigation" mechanism for the rest of the
// session. sessionStorage survives a component remount because it belongs to
// the browsing context (the iframe's own tab-scoped storage), not to any
// particular React instance, so a fresh mount can recover the origin a ref
// would have lost.
const STORAGE_KEY = 'altarwed:preview:editor-origin'

export function readStoredEditorOrigin(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    // sessionStorage can throw in some private-browsing / storage-partitioned
    // contexts; fail open to null. The ref refreshes on the next 'tab-switch'
    // message either way, so this only matters for a remount before that.
    return null
  }
}

export function storeEditorOrigin(origin: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, origin)
  } catch {
    // Best effort only; see readStoredEditorOrigin.
  }
}
