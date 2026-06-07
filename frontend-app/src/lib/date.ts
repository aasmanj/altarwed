// Parse a YYYY-MM-DD string as LOCAL noon so toLocaleDateString() can never
// roll back a day in negative-UTC-offset timezones.
function parseLocal(iso: string): Date {
  if (iso.includes('T')) return new Date(iso)
  return new Date(iso + 'T12:00:00')
}

export function formatWeddingDate(iso: string): string {
  return parseLocal(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function formatShortDate(iso: string): string {
  return parseLocal(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function daysUntilDate(iso: string): number {
  return Math.ceil((parseLocal(iso).getTime() - Date.now()) / 86_400_000)
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

// The date a planning task is "due": `months` before the wedding date. Anchors to
// the 1st before shifting the month so a wedding on the 29th-31st cannot overflow
// into the following month (setMonth would roll Feb 31 forward to Mar 3), then
// clamps the day back to a valid day-of-month.
export function dueDateBefore(weddingIso: string, months: number): Date {
  const d = parseLocal(weddingIso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() - months)
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())))
  return d
}

// Compact label for a target date, e.g. "Apr 2027".
export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// The date a task is "due", fitted to the couple's actual planning runway.
//
// The naive offset ("book venue 12 months before") lands in the past for a couple
// engaged less than a year, so every long-lead task shows as overdue on day one.
// The earlier fix linearly compressed the whole plan into engagement -> wedding,
// but that pushed *fixed-deadline* near-wedding tasks (mail invitations, RSVP
// cutoff, final headcount) LATER than physically possible.
//
// The model here keeps real deadlines intact and only pulls in what doesn't fit:
//   - If the natural due date still falls within the runway (>= engagement date),
//     use it. Near-wedding tasks always fit, so their hard deadlines are preserved.
//   - If the natural due date is before the engagement date (the task wants more
//     lead time than the couple has), collapse it to the engagement date: "this is
//     catch-up work, start it now." Several overflow tasks stacking on the
//     engagement date is the correct signal, not a bug.
export function scaledDueDate(weddingIso: string, startIso: string | null, monthsBefore: number): Date {
  const naturalDue = dueDateBefore(weddingIso, monthsBefore)
  if (!startIso) return naturalDue
  const start = parseLocal(startIso)
  const wedding = parseLocal(weddingIso)
  // Guard a fat-fingered engagement date (on/after the wedding): fall back to the
  // natural offsets rather than collapsing every task onto a post-wedding date.
  if (wedding.getTime() <= start.getTime()) return naturalDue
  return naturalDue.getTime() >= start.getTime() ? naturalDue : start
}
