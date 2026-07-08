// Portable "add to calendar" .ics builder for the RSVP confirmation screen (issue #330).
//
// Why a downloadable .ics rather than a Google/Outlook deep link: a single-event
// VCALENDAR imports into Google Calendar, Apple Calendar, and Outlook with no OAuth
// and no provider-specific URL, so one code path serves every guest's calendar app.
//
// Timezone stance (deliberate): the wedding website stores a free-form ceremony time
// string but no venue timezone. We therefore emit a FLOATING local time (no trailing
// `Z`, no TZID), which every calendar app interprets as "this wall-clock time,
// wherever the viewer is". For a wedding at a fixed physical venue that is the correct
// behavior: "4:00 PM" should read as 4:00 PM to every guest, not be shifted by their
// device offset the way a UTC-anchored time would be.
//
// The builder is a pure function (string in, string out) so it is unit-testable in a
// node environment; the browser-only download side effect lives in `downloadIcs`.

export interface IcsParams {
  coupleNames: string
  // Raw ISO date (yyyy-MM-dd). Null/empty yields no event (the caller hides the button).
  weddingDateIso: string | null
  // Free-form ceremony time as the couple typed it. Parses to a timed event, else all-day.
  ceremonyTime?: string | null
  venueName?: string | null
  venueAddress?: string | null
  venueCity?: string | null
  venueState?: string | null
  // Injected for deterministic tests; defaults to the current time. Used for DTSTAMP only.
  now?: Date
}

// Parses the couple's free-form ceremony time into 24-hour {hour, minute}, or null when it
// does not look like a clock time (or is dangerously ambiguous). Accepts "4:00 PM", "4 PM",
// "4pm", "4:30pm", and 24-hour "16:00" / "04:00". Anything else (empty, "TBD", "afternoon")
// returns null so the caller falls back to an all-day event.
//
// Ambiguity guard (issue #330 review): a bare hour with no AM/PM in the 1-11 range could mean
// either morning or afternoon. Couples routinely type "4:00" meaning 4 PM for an afternoon
// ceremony, so silently reading it as 04:00 (4 AM) would emit a valid-looking but wrong VEVENT
// that is worse than the honest all-day fallback. We therefore only trust a meridiem-less hour
// when it is unambiguous: 0 or 12-23 (already 24-hour / midnight / noon), or written in explicit
// zero-padded 24-hour form ("04:00"). A single-digit "4:00" falls through to null.
export function parseCeremonyTime(raw: string | null | undefined): { hour: number; minute: number } | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!m) return null

  const hourText = m[1]
  let hour = parseInt(hourText, 10)
  const minute = m[2] ? parseInt(m[2], 10) : 0
  const meridiem = m[3] ? m[3].toLowerCase() : null

  if (minute > 59) return null

  if (meridiem) {
    // 12-hour clock: 12 AM is 00:00, 12 PM is 12:00, otherwise add 12 for PM.
    if (hour < 1 || hour > 12) return null
    if (meridiem === 'pm' && hour !== 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
  } else {
    // No meridiem: only trust an unambiguous 24-hour reading.
    if (hour > 23) return null
    const explicit24Hour = hourText.length === 2 && hourText[0] === '0'
    const unambiguous = hour === 0 || hour >= 12 || explicit24Hour
    if (!unambiguous) return null
  }

  return { hour, minute }
}

// Escapes a TEXT value per RFC 5545: backslash, semicolon, comma, and newlines are special.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Folds a single content line per RFC 5545 section 3.1: no physical line may exceed 75 octets
// (excluding the CRLF), and a long line is split into a first line plus continuation lines that
// each begin with a single leading space. Un-folding (stripping "CRLF space") reconstructs the
// original. We measure in UTF-8 octets, not characters, and iterate whole code points so a
// multi-byte character (accented couple/venue names) is never split across a fold boundary. A
// continuation line's leading space counts toward its own 75-octet budget.
function foldLine(line: string): string {
  const MAX_OCTETS = 75
  const encoder = new TextEncoder()
  const pieces: string[] = []
  let current = ''
  let currentOctets = 0
  let first = true

  for (const ch of Array.from(line)) {
    const chOctets = encoder.encode(ch).length
    // Continuation lines spend one octet on the leading space before any content.
    const overhead = first ? 0 : 1
    if (current !== '' && currentOctets + chOctets + overhead > MAX_OCTETS) {
      pieces.push(first ? current : ' ' + current)
      first = false
      current = ''
      currentOctets = 0
    }
    current += ch
    currentOctets += chOctets
  }
  pieces.push(first ? current : ' ' + current)

  return pieces.join('\r\n')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Floating local timestamp (no Z, no TZID): YYYYMMDDTHHMMSS.
function formatFloating(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

// UTC timestamp for DTSTAMP (the moment the .ics was generated): YYYYMMDDTHHMMSSZ.
function formatUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

// A stable, deterministic UID: re-downloading the same wedding yields the same UID, so a
// calendar app updates the existing entry instead of creating a duplicate. Derived from the
// date plus a slugified couple name; no randomness, no PII beyond the public couple name.
function buildUid(weddingDateIso: string, coupleNames: string): string {
  const slug = coupleNames.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'wedding'
  return `${weddingDateIso.replace(/-/g, '')}-${slug}@altarwed.com`
}

/**
 * Builds a single-event VCALENDAR string, or null when there is no wedding date to anchor it.
 *
 * - Parseable ceremony time -> timed floating event, DTEND = DTSTART + 3 hours.
 * - Missing/garbage time     -> all-day event (DTSTART;VALUE=DATE, DTEND next day).
 */
export function buildWeddingIcs(params: IcsParams): string | null {
  const { coupleNames, weddingDateIso, ceremonyTime, venueName, venueAddress, venueCity, venueState } = params
  if (!weddingDateIso) return null

  const [year, month, day] = weddingDateIso.split('-').map(Number)
  if (!year || !month || !day) return null

  const location = [venueName, venueAddress, venueCity, venueState]
    .map(part => (part ?? '').trim())
    .filter(part => part !== '')
    .join(', ')

  const dtstamp = formatUtcStamp(params.now ?? new Date())
  const uid = buildUid(weddingDateIso, coupleNames)
  const summary = `${coupleNames} Wedding`

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AltarWed//RSVP//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
  ]

  const time = parseCeremonyTime(ceremonyTime)
  if (time) {
    // Floating local event. Build a local Date so +3h arithmetic handles hour/day rollover,
    // then read wall-clock components back out (floating = no offset applied).
    const start = new Date(year, month - 1, day, time.hour, time.minute, 0)
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)
    lines.push(`DTSTART:${formatFloating(start)}`)
    lines.push(`DTEND:${formatFloating(end)}`)
  } else {
    // All-day event. DTEND for an all-day VEVENT is the (exclusive) next day per RFC 5545.
    const startDate = `${year}${pad(month)}${pad(day)}`
    const next = new Date(year, month - 1, day + 1)
    const endDate = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
    lines.push(`DTSTART;VALUE=DATE:${startDate}`)
    lines.push(`DTEND;VALUE=DATE:${endDate}`)
  }

  lines.push(`SUMMARY:${escapeText(summary)}`)
  if (location) lines.push(`LOCATION:${escapeText(location)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')

  // Fold every content line to <=75 octets before joining (RFC 5545 section 3.1).
  return lines.map(foldLine).join('\r\n')
}

// A filesystem-safe filename for the download, e.g. "jordan-and-eden-wedding.ics".
export function icsFilename(coupleNames: string): string {
  const slug = coupleNames.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'wedding'
  return `${slug}-wedding.ics`
}

// Browser-only: turns the .ics text into a downloaded file. Kept out of buildWeddingIcs so the
// builder stays a pure, testable function. No-op if called without a DOM.
export function downloadIcs(filename: string, ics: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
