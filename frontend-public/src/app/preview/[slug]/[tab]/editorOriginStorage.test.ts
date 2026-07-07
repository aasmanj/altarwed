import { describe, it, expect, afterEach } from 'vitest'
import { readStoredEditorOrigin, storeEditorOrigin } from './editorOriginStorage'

// Issue #310 follow-up: TabSwitchListener's editorOriginRef is seeded from
// sessionStorage (not just a plain useRef) because there is no layout.tsx
// under app/preview/, so whether Next preserves this client component's
// identity across a soft navigation to a different [tab] value is
// version-sensitive. If the component is destroyed and recreated, a plain
// ref resets to null and 'preview-tab-ready' silently stops firing. These
// tests exercise the storage helper directly; frontend-public's vitest runs
// in a node environment (no jsdom), so there is no real DOM/React remount to
// trigger -- instead this simulates a remount as two independent reads
// against the same underlying sessionStorage, since that is exactly what
// distinguishes it from a ref: a ref is scoped to one component instance, but
// sessionStorage belongs to the browsing context and outlives any single
// instance.

// Minimal in-memory Storage stand-in. Node's default vitest environment has
// no `window` global at all, so tests install/remove one per test.
function makeMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size },
  }
}

describe('editorOriginStorage (issue #310 follow-up)', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('returns null when no origin has ever been learned', () => {
    (globalThis as unknown as { window: unknown }).window = { sessionStorage: makeMemoryStorage() }
    expect(readStoredEditorOrigin()).toBeNull()
  })

  it('persists an origin across independent reads, simulating survival across a component remount', () => {
    (globalThis as unknown as { window: unknown }).window = { sessionStorage: makeMemoryStorage() }
    storeEditorOrigin('https://app.altarwed.com')

    // First read: stands in for the original TabSwitchListener instance's
    // initial ref hydration.
    expect(readStoredEditorOrigin()).toBe('https://app.altarwed.com')

    // A remount would create a brand-new component instance whose plain
    // useRef would start out null again. The only thing that could recover
    // the origin is a fresh read from the SAME underlying storage -- which is
    // exactly what a second, independent call demonstrates here, since
    // nothing in this module is scoped to a single "instance".
    expect(readStoredEditorOrigin()).toBe('https://app.altarwed.com')
  })

  it('a later storeEditorOrigin call overwrites the previously learned origin (editor origin can change between local dev ports)', () => {
    (globalThis as unknown as { window: unknown }).window = { sessionStorage: makeMemoryStorage() }
    storeEditorOrigin('http://localhost:5173')
    expect(readStoredEditorOrigin()).toBe('http://localhost:5173')
    storeEditorOrigin('http://127.0.0.1:5173')
    expect(readStoredEditorOrigin()).toBe('http://127.0.0.1:5173')
  })

  it('never throws when window/sessionStorage is unavailable (SSR or storage-partitioned contexts)', () => {
    delete (globalThis as { window?: unknown }).window
    expect(() => storeEditorOrigin('https://app.altarwed.com')).not.toThrow()
    expect(readStoredEditorOrigin()).toBeNull()
  })

  it('never throws when sessionStorage itself throws (e.g. private-browsing quota)', () => {
    (globalThis as unknown as { window: unknown }).window = {
      sessionStorage: {
        getItem() { throw new Error('SecurityError') },
        setItem() { throw new Error('SecurityError') },
      },
    }
    expect(() => storeEditorOrigin('https://app.altarwed.com')).not.toThrow()
    expect(readStoredEditorOrigin()).toBeNull()
  })
})
