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

const DAY_MS = 86_400_000
// The seeded checklist assumes the longest lead task is ~12 months before the
// wedding. We scale relative to that span.
const PLAN_SPAN_MONTHS = 12
// Approx length of the full 12-month plan in ms (avg month = 30.4375 days).
const FULL_PLAN_MS = PLAN_SPAN_MONTHS * 30.4375 * DAY_MS

// The date a task is "due", scaled to the couple's actual planning runway.
// Without scaling, a couple engaged for less than a year sees every long-lead
// task ("book venue 12 months before") land ~a year in the past. Anchoring on
// the engagement date and compressing the plan into engagement -> wedding fixes
// that: the longest-lead task sits at the engagement date, the shortest near the
// wedding. When the runway is >= the full 12-month plan (or no engagement date
// is set), we keep the natural month offsets via dueDateBefore.
export function scaledDueDate(weddingIso: string, startIso: string | null, monthsBefore: number): Date {
  if (!startIso) return dueDateBefore(weddingIso, monthsBefore)
  const wedding = parseLocal(weddingIso)
  const windowMs = wedding.getTime() - parseLocal(startIso).getTime()
  if (windowMs <= 0 || windowMs >= FULL_PLAN_MS) return dueDateBefore(weddingIso, monthsBefore)
  const fraction = Math.min(monthsBefore, PLAN_SPAN_MONTHS) / PLAN_SPAN_MONTHS
  return new Date(wedding.getTime() - fraction * windowMs)
}
