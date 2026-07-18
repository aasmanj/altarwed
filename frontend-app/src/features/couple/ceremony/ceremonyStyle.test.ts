import { describe, it, expect } from 'vitest'
import {
  CEREMONY_STYLE_OPTIONS,
  CEREMONY_STYLES,
  DEFAULT_CEREMONY_STYLE_KEY,
  ceremonyStyleStorageKey,
  loadCeremonyStyleKey,
  resolveCeremonyStyle,
  resolveCeremonyStyleKey,
  safeAccent,
  saveCeremonyStyleKey,
  type CeremonyStyleKey,
} from './ceremonyStyle'

// Minimal in-memory Storage stand-in so the persistence tests run under vitest's
// node environment, where window.localStorage does not exist.
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed))
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k) },
    setItem: (k: string, v: string) => { map.set(k, v) },
  }
}

describe('safeAccent (accent color reused from website.accentColor)', () => {
  it('passes through valid hex colors so they reach the program style sink', () => {
    expect(safeAccent('#7b2d3a', null)).toBe('#7b2d3a')
    expect(safeAccent('#FFF', null)).toBe('#FFF')
    expect(safeAccent('#d4af6aff', null)).toBe('#d4af6aff')
  })

  it('falls back for null, empty, or non-color strings (no untrusted value in the sink)', () => {
    expect(safeAccent(null, null)).toBeNull()
    expect(safeAccent(undefined, null)).toBeNull()
    expect(safeAccent('', null)).toBeNull()
    expect(safeAccent('red', null)).toBeNull()
    expect(safeAccent('#12', null)).toBeNull()
    expect(safeAccent('javascript:alert(1)', '#000000')).toBe('#000000')
  })
})

describe('ceremony style presets (the style/font selector)', () => {
  it('exposes exactly three visibly distinct presets', () => {
    expect(CEREMONY_STYLE_OPTIONS.map(o => o.key)).toEqual(['classic', 'modern', 'script'])
  })

  it('gives each preset a distinct display font so the typography visibly changes', () => {
    expect(CEREMONY_STYLES.classic.displayFont).toBe('font-serif')
    expect(CEREMONY_STYLES.modern.displayFont).toBe('font-sans')
    expect(CEREMONY_STYLES.script.displayFont).toBe('font-script')
    const displays = CEREMONY_STYLE_OPTIONS.map(o => o.displayFont)
    expect(new Set(displays).size).toBe(displays.length)
  })

  it('keeps script body text legible (serif, not the script face)', () => {
    expect(CEREMONY_STYLES.script.bodyFont).toBe('font-serif')
    expect(CEREMONY_STYLES.script.numeralFont).toBe('font-script')
  })

  it('resolves a known key to its preset and an unknown/hostile key to Classic', () => {
    expect(resolveCeremonyStyleKey('modern')).toBe('modern')
    expect(resolveCeremonyStyle('script').key).toBe('script')
    expect(resolveCeremonyStyleKey('bogus')).toBe(DEFAULT_CEREMONY_STYLE_KEY)
    expect(resolveCeremonyStyleKey(null)).toBe('classic')
    expect(resolveCeremonyStyleKey('__proto__')).toBe('classic')
    expect(resolveCeremonyStyle('toString').key).toBe('classic')
  })
})

describe('style persistence (per-couple localStorage, no backend column)', () => {
  const coupleId = 'couple-42'

  it('namespaces the storage key per couple', () => {
    expect(ceremonyStyleStorageKey(coupleId)).toBe('altarwed.ceremonyStyle.couple-42')
    expect(ceremonyStyleStorageKey('other')).not.toBe(ceremonyStyleStorageKey(coupleId))
  })

  it('saves a choice and loads it back for the same couple', () => {
    const storage = memoryStorage()
    saveCeremonyStyleKey(storage, coupleId, 'script')
    expect(loadCeremonyStyleKey(storage, coupleId)).toBe('script')
  })

  it('does not leak one couple\'s choice to another couple', () => {
    const storage = memoryStorage()
    saveCeremonyStyleKey(storage, coupleId, 'modern')
    expect(loadCeremonyStyleKey(storage, 'couple-99')).toBe('classic')
  })

  it('defaults to Classic when nothing is stored or storage is unavailable', () => {
    expect(loadCeremonyStyleKey(memoryStorage(), coupleId)).toBe('classic')
    expect(loadCeremonyStyleKey(undefined, coupleId)).toBe('classic')
  })

  it('ignores a corrupted stored value and returns Classic', () => {
    const storage = memoryStorage({ [ceremonyStyleStorageKey(coupleId)]: 'not-a-style' })
    expect(loadCeremonyStyleKey(storage, coupleId)).toBe('classic')
  })

  it('survives a storage that throws (private mode) without crashing', () => {
    const throwing: Storage = {
      get length() { return 0 },
      clear: () => {},
      getItem: () => { throw new Error('denied') },
      key: () => null,
      removeItem: () => {},
      setItem: () => { throw new Error('denied') },
    }
    const key: CeremonyStyleKey = 'modern'
    expect(() => saveCeremonyStyleKey(throwing, coupleId, key)).not.toThrow()
    expect(loadCeremonyStyleKey(throwing, coupleId)).toBe('classic')
  })
})
