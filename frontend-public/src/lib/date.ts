// Parse a YYYY-MM-DD string as LOCAL noon so toLocaleDateString() can never
// roll back a day in negative-UTC-offset timezones. `new Date('2026-08-15')`
// is parsed as UTC midnight per ISO 8601, which becomes Aug 14 in any
// negative UTC offset, the source of the "date off by one" bug.
function parseLocal(iso: string): Date {
  // If the string already has a time component, trust it.
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
