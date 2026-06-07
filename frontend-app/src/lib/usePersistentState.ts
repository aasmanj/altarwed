import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

// Stored shape: the value plus the epoch-ms it was last written. The timestamp
// powers an optional idle-TTL so an abandoned draft on a shared/kiosk tab does
// not prefill one person's data for the next visitor.
interface Persisted<T> {
  v: T
  t: number
}

function hasShape<T>(parsed: unknown): parsed is Persisted<T> {
  return (
    parsed != null &&
    typeof parsed === 'object' &&
    'v' in parsed &&
    typeof (parsed as { t?: unknown }).t === 'number'
  )
}

// Read a persisted draft. Returns `fallback` when the key is absent, malformed,
// in an old (pre-wrapper) format, or older than `ttlMs` (when provided). An
// expired draft is also removed so it can't linger.
export function readPersistedState<T>(key: string, fallback: T, ttlMs?: number): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.sessionStorage.getItem(key)
    if (raw == null) return fallback
    const parsed = JSON.parse(raw) as unknown
    if (!hasShape<T>(parsed)) return fallback
    if (ttlMs != null && Date.now() - parsed.t > ttlMs) {
      window.sessionStorage.removeItem(key)
      return fallback
    }
    return parsed.v
  } catch {
    return fallback
  }
}

// Write a draft, stamping it with the current time. Best-effort: a quota error
// or private-mode rejection is swallowed (persistence is a nicety, not required).
export function writePersistedState<T>(key: string, value: T): void {
  try {
    const payload: Persisted<T> = { v: value, t: Date.now() }
    window.sessionStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Quota exceeded or private mode: ignore.
  }
}

export function clearPersistentState(key: string): void {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// useState backed by sessionStorage: the value survives a page refresh but is
// cleared when the tab closes. That is the right lifetime for an in-progress
// signup or onboarding form, where a refresh should not wipe what the couple
// typed, but a closed tab should not leave half-entered data lying around.
//
// Pass `ttlMs` to also discard a draft that has sat idle too long (the write
// timestamp refreshes on every change, so the TTL is measured from the last
// edit). This is the privacy guard for shared/kiosk devices.
//
// NEVER store secrets here. sessionStorage is readable by any script on the
// origin, so passwords and tokens stay out of it.
export function usePersistentState<T>(
  key: string,
  initial: T,
  options?: { ttlMs?: number },
): [T, Dispatch<SetStateAction<T>>] {
  const ttlMs = options?.ttlMs
  const [state, setState] = useState<T>(() => readPersistedState(key, initial, ttlMs))

  useEffect(() => {
    writePersistedState(key, state)
  }, [key, state])

  return [state, setState]
}
