'use client'

const CONSENT_KEY = 'altarwed_consent'

export type ConsentChoice = 'accepted' | 'declined' | null

export function getConsent(): ConsentChoice {
  if (typeof window === 'undefined') return null
  // Honor the GPC signal as an automatic opt-out without showing the banner.
  if ((navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true) {
    return 'declined'
  }
  const stored = localStorage.getItem(CONSENT_KEY)
  if (stored === 'accepted' || stored === 'declined') return stored
  return null
}

export function setConsent(choice: 'accepted' | 'declined'): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONSENT_KEY, choice)
  window.dispatchEvent(new Event('altarwed_consent_change'))
}

export function hasConsented(): boolean {
  return getConsent() === 'accepted'
}
