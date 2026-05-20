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
