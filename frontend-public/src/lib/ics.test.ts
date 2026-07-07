import { describe, it, expect } from 'vitest'
import { buildWeddingIcs, parseCeremonyTime, icsFilename } from '@/lib/ics'

// Unit tests for the RSVP "add to calendar" .ics builder (issue #330). The builder is a
// pure function, so we assert on the emitted VCALENDAR text: (a) a parseable ceremony time
// produces a timed floating DTSTART + a 3-hour DTEND, (b) a missing/garbage time falls back
// to a VALUE=DATE all-day event, and (c) LOCATION concatenation skips null/blank parts.
//
// A fixed `now` keeps DTSTAMP deterministic. DTSTART uses local wall-clock (floating time,
// no Z) by design, so a fixed date/time with no meridiem shift is asserted directly.

const NOW = new Date(Date.UTC(2026, 0, 2, 3, 4, 5))

describe('parseCeremonyTime', () => {
  it('parses 12-hour times with a meridiem', () => {
    expect(parseCeremonyTime('4:00 PM')).toEqual({ hour: 16, minute: 0 })
    expect(parseCeremonyTime('4 PM')).toEqual({ hour: 16, minute: 0 })
    expect(parseCeremonyTime('4:30pm')).toEqual({ hour: 16, minute: 30 })
    expect(parseCeremonyTime('12:00 AM')).toEqual({ hour: 0, minute: 0 })
    expect(parseCeremonyTime('12:00 PM')).toEqual({ hour: 12, minute: 0 })
  })

  it('parses 24-hour times without a meridiem', () => {
    expect(parseCeremonyTime('16:00')).toEqual({ hour: 16, minute: 0 })
    expect(parseCeremonyTime('9:15')).toEqual({ hour: 9, minute: 15 })
  })

  it('returns null for empty or non-time text', () => {
    expect(parseCeremonyTime('')).toBeNull()
    expect(parseCeremonyTime(null)).toBeNull()
    expect(parseCeremonyTime(undefined)).toBeNull()
    expect(parseCeremonyTime('TBD')).toBeNull()
    expect(parseCeremonyTime('afternoon')).toBeNull()
    expect(parseCeremonyTime('25:00')).toBeNull()
    expect(parseCeremonyTime('4:75 PM')).toBeNull()
  })
})

describe('buildWeddingIcs', () => {
  it('builds a timed floating event with a 3-hour default duration when the time parses', () => {
    const ics = buildWeddingIcs({
      coupleNames: 'Jordan & Eden',
      weddingDateIso: '2026-06-20',
      ceremonyTime: '4:00 PM',
      venueName: 'Grace Chapel',
      venueAddress: '123 Chapel Lane',
      venueCity: 'Austin',
      venueState: 'TX',
      now: NOW,
    })

    expect(ics).not.toBeNull()
    const body = ics as string
    // Well-formed single-event calendar.
    expect(body.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(body.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(body).toContain('BEGIN:VEVENT')
    expect(body).toContain('END:VEVENT')
    // Floating local time: no trailing Z, no TZID. 4:00 PM -> 160000, +3h -> 190000.
    expect(body).toContain('DTSTART:20260620T160000')
    expect(body).toContain('DTEND:20260620T190000')
    expect(body).not.toContain('DTSTART:20260620T160000Z')
    // Summary and full location (all parts joined).
    expect(body).toContain('SUMMARY:Jordan & Eden Wedding')
    expect(body).toContain('LOCATION:Grace Chapel\\, 123 Chapel Lane\\, Austin\\, TX')
    // Stable UID + a DTSTAMP.
    expect(body).toContain('UID:20260620-jordan-eden@altarwed.com')
    expect(body).toContain('DTSTAMP:20260102T030405Z')
    // CRLF line endings per RFC 5545.
    expect(body).toContain('\r\n')
  })

  it('rolls the DTEND into the next day when start + 3h crosses midnight', () => {
    const ics = buildWeddingIcs({
      coupleNames: 'A & B',
      weddingDateIso: '2026-06-20',
      ceremonyTime: '10:30 PM',
      now: NOW,
    }) as string
    expect(ics).toContain('DTSTART:20260620T223000')
    // 22:30 + 3h = 01:30 the following day.
    expect(ics).toContain('DTEND:20260621T013000')
  })

  it('falls back to an all-day VALUE=DATE event when the time is missing or unparseable', () => {
    for (const t of [null, '', 'TBD', 'sometime']) {
      const ics = buildWeddingIcs({
        coupleNames: 'Jordan & Eden',
        weddingDateIso: '2026-06-20',
        ceremonyTime: t,
        venueName: 'Grace Chapel',
        now: NOW,
      }) as string
      expect(ics).toContain('DTSTART;VALUE=DATE:20260620')
      // All-day DTEND is the exclusive next day.
      expect(ics).toContain('DTEND;VALUE=DATE:20260621')
      // No timed DTSTART leaked in.
      expect(ics).not.toContain('DTSTART:20260620T')
    }
  })

  it('skips null and blank parts when building LOCATION', () => {
    const ics = buildWeddingIcs({
      coupleNames: 'Jordan & Eden',
      weddingDateIso: '2026-06-20',
      ceremonyTime: '4:00 PM',
      venueName: 'Grace Chapel',
      venueAddress: null,
      venueCity: '   ',
      venueState: 'TX',
      now: NOW,
    }) as string
    // Only the two non-blank parts survive, joined by a comma, with no empty segments.
    expect(ics).toContain('LOCATION:Grace Chapel\\, TX')
    expect(ics).not.toContain('Chapel Lane')
  })

  it('omits LOCATION entirely when no venue parts are present', () => {
    const ics = buildWeddingIcs({
      coupleNames: 'Jordan & Eden',
      weddingDateIso: '2026-06-20',
      ceremonyTime: '4:00 PM',
      now: NOW,
    }) as string
    expect(ics).not.toContain('LOCATION:')
  })

  it('returns null when there is no wedding date to anchor the event', () => {
    expect(buildWeddingIcs({ coupleNames: 'Jordan & Eden', weddingDateIso: null })).toBeNull()
    expect(buildWeddingIcs({ coupleNames: 'Jordan & Eden', weddingDateIso: '' })).toBeNull()
  })

  it('produces a filesystem-safe download filename', () => {
    expect(icsFilename('Jordan & Eden')).toBe('jordan-eden-wedding.ics')
    expect(icsFilename('')).toBe('wedding-wedding.ics')
  })
})
