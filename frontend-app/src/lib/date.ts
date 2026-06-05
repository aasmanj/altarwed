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
