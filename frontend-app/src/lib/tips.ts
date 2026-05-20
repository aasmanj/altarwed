// Seed copy for TipCallout. Each tip has a stable id so a dismiss can be
// remembered in localStorage. Keep tips short, actionable, and faith-friendly.

export interface Tip {
  id: string
  title: string
  body: string
}

export const TIPS: Record<string, Tip> = {
  dashboardWelcome: {
    id: 'dashboardWelcome',
    title: 'Set the foundation first',
    body: 'Lock in your venue, ceremony time, and dress code before sharing your site. Guests rely on these to plan travel.',
  },
  guestsRsvpTiming: {
    id: 'guestsRsvpTiming',
    title: 'Send RSVPs about 30 days out',
    body: 'Too early and guests forget; too late and you miss meal counts. Four weeks is the sweet spot for most weddings.',
  },
  checklistFaith: {
    id: 'checklistFaith',
    title: 'Plan the marriage, not just the wedding',
    body: 'Set aside time for premarital counseling and prayer with your partner. It matters more than the seating chart.',
  },
  budgetGoal: {
    id: 'budgetGoal',
    title: 'Set a goal before you spend',
    body: 'Couples who set a written budget goal up front are far more likely to stay under it. Use the goal field at the top.',
  },
  seatingBeforeLock: {
    id: 'seatingBeforeLock',
    title: 'Lock the chart when you finalize',
    body: 'Once seating is set, hit "Lock chart" to alphabetize each table by name. Makes printing place cards easy.',
  },
}
