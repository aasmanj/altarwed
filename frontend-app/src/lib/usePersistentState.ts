import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

// useState backed by sessionStorage: the value survives a page refresh but is
// cleared when the tab closes. That is the right lifetime for an in-progress
// signup or onboarding form, where a refresh should not wipe what the couple
// typed, but a closed tab should not leave half-entered data lying around.
//
// NEVER store secrets here. sessionStorage is readable by any script on the
// origin, so passwords and tokens stay out of it.
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const raw = window.sessionStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Quota exceeded or private mode: persistence is best-effort, ignore.
    }
  }, [key, state])

  return [state, setState]
}

export function clearPersistentState(key: string) {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}
