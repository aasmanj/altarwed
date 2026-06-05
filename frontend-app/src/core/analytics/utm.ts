// First-touch marketing attribution, captured client-side and sent to the
// backend with the registration payload so it lands on the couples table (V46)
// and feeds the /admin/metrics acquisition breakdown. First-party and
// ad-blocker-proof: unlike the PostHog/Meta pixels, this survives because the
// signup POST is our own request.
//
// Field names match the backend AcquisitionInfo DTO exactly so the object
// serialises straight into the request body.
export interface Acquisition {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  referrer: string | null
  landingPath: string | null
}

const STORAGE_KEY = 'altarwed.acq'
const MAX_LEN = 255

function clip(v: string | null | undefined): string | null {
  if (!v) return null
  const t = v.trim()
  if (!t) return null
  return t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t
}

function readCurrent(): Acquisition {
  const p = new URLSearchParams(window.location.search)
  return {
    utmSource: clip(p.get('utm_source')),
    utmMedium: clip(p.get('utm_medium')),
    utmCampaign: clip(p.get('utm_campaign')),
    utmTerm: clip(p.get('utm_term')),
    utmContent: clip(p.get('utm_content')),
    referrer: clip(document.referrer),
    landingPath: clip(window.location.pathname),
  }
}

function hasUtm(a: Acquisition): boolean {
  return !!(a.utmSource || a.utmMedium || a.utmCampaign)
}

/**
 * Records attribution from the current URL, with a first-touch-but-upgradable
 * rule tuned for paid-ad attribution:
 *   - The first UTM-bearing visit wins and is pinned forever (so two ad clicks
 *     attribute to the first ad, not the most recent).
 *   - A UTM-bearing visit overrides an earlier organic/direct landing (so an
 *     organic visit to /login doesn't rob a later ad click of its credit).
 *   - Absent any prior record, an organic landing is stored as a weak signal
 *     (referrer + landing path) so direct signups aren't a total blank.
 * Call once on app load.
 */
export function captureUtmFromUrl(): void {
  if (typeof window === 'undefined') return
  const current = readCurrent()
  const stored = getStoredAcquisition()

  if (hasUtm(current) && !(stored && hasUtm(stored))) {
    save(current) // upgrade organic/empty -> first paid touch
  } else if (!stored) {
    save(current) // first touch ever, organic/direct
  }
  // else: keep the existing first-touch record untouched
}

function save(a: Acquisition): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a))
  } catch {
    // Private-mode / storage-disabled: attribution is best-effort, never block signup.
  }
}

export function getStoredAcquisition(): Acquisition | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as Acquisition
  } catch {
    return undefined
  }
}

// Cleared after a successful signup so a second account created on the same
// browser is not mis-attributed to the first couple's campaign.
export function clearStoredAcquisition(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
