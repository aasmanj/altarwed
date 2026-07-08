import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { distinctPartyNames } from './partyNames'
import type { Guest } from './useGuests'

// Issue #238: the Party / household input was free text with no visibility into
// households that already existed, so "The Smith Family" and "Smith Family"
// silently created two households that would never RSVP together. The fix feeds
// a <datalist> of the distinct existing party names so the couple sees, and can
// reuse, a household that is already on the roster. Free text must still work.
//
// frontend-app's vitest runs in a node environment (no jsdom / testing-library),
// so the datalist wiring is verified with source-level assertions, mirroring the
// sibling hardening tests (dashboardShareModal.test.ts, formInputLabels.test.ts),
// while the suggestion set itself is verified as a pure function.

function makeGuest(overrides: Partial<Guest> & { name: string }): Guest {
  return {
    id: overrides.name,
    coupleId: 'couple-1',
    email: null,
    phone: null,
    rsvpStatus: 'PENDING',
    plusOneAllowed: false,
    plusOneName: null,
    dietaryRestrictions: null,
    songRequest: null,
    tableNumber: null,
    side: null,
    notes: null,
    mailLine1: null,
    mailCity: null,
    mailState: null,
    mailZip: null,
    mailCountry: null,
    noteForCouple: null,
    inviteSendCount: null,
    inviteSentAt: null,
    saveTheDateSentAt: null,
    respondedAt: null,
    partyId: null,
    partyName: null,
    partyContact: null,
    saveTheDateDeliveryStatus: null,
    inviteDeliveryStatus: null,
    emailUnsubscribed: null,
    emailUnsubscribedReason: null,
    ...overrides,
  }
}

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), 'src', rel), 'utf8')
}

describe('distinctPartyNames (issue #238 datalist suggestions)', () => {
  it('lists each distinct household exactly once, sorted', () => {
    const guests = [
      makeGuest({ name: 'Ann', partyName: 'The Smith Family' }),
      makeGuest({ name: 'Bob', partyName: 'The Smith Family' }),
      makeGuest({ name: 'Cate', partyName: 'Jones Household' }),
    ]

    expect(distinctPartyNames(guests)).toEqual(['Jones Household', 'The Smith Family'])
  })

  it('collapses case-insensitive duplicates, keeping the first spelling typed', () => {
    const guests = [
      makeGuest({ name: 'Ann', partyName: 'Smith Family' }),
      makeGuest({ name: 'Bob', partyName: 'smith family' }),
    ]

    expect(distinctPartyNames(guests)).toEqual(['Smith Family'])
  })

  it('keeps genuinely different near-miss spellings as separate options (the divergence signal)', () => {
    const guests = [
      makeGuest({ name: 'Ann', partyName: 'Smith Family' }),
      makeGuest({ name: 'Bob', partyName: 'The Smith Family' }),
    ]

    // Both appear so the couple can see the near-miss and pick the existing one
    // instead of unknowingly creating a second household.
    expect(distinctPartyNames(guests)).toEqual(['Smith Family', 'The Smith Family'])
  })

  it('ignores guests with no household and trims surrounding whitespace', () => {
    const guests = [
      makeGuest({ name: 'Ann', partyName: null }),
      makeGuest({ name: 'Bob', partyName: '   ' }),
      makeGuest({ name: 'Cate', partyName: '  Rivera Family  ' }),
    ]

    expect(distinctPartyNames(guests)).toEqual(['Rivera Family'])
  })

  it('returns an empty list when nobody has a household yet', () => {
    expect(distinctPartyNames([])).toEqual([])
  })
})

describe('GuestListPage party input wiring (issue #238)', () => {
  const src = read('features/couple/guests/GuestListPage.tsx')

  it('computes the distinct household suggestions from the loaded guest list', () => {
    expect(src).toContain("import { distinctPartyNames } from './partyNames'")
    expect(src).toContain('const partyOptions = useMemo(() => distinctPartyNames(guests), [guests])')
  })

  it('renders a <datalist> populated from the suggestion set', () => {
    expect(src).toContain('function PartyOptionsDatalist({ id, options }')
    expect(src).toContain('<datalist id={id}>')
    expect(src).toContain('{options.map(name => <option key={name} value={name} />)}')
  })

  it('wires both the add and edit party inputs to the datalist and passes the options down', () => {
    expect(src).toContain('list="party-household-options-add"')
    expect(src).toContain('list="party-household-options-edit"')
    expect(src).toContain('<PartyOptionsDatalist id="party-household-options-add" options={partyOptions} />')
    expect(src).toContain('<PartyOptionsDatalist id="party-household-options-edit" options={partyOptions} />')
    // Both render sites forward the shared suggestion set.
    expect(src.match(/partyOptions=\{partyOptions\}/g)?.length).toBe(2)
  })

  it('keeps the party field free text: a suggesting <input list=...>, never a closed <select>', () => {
    // The party control stays a text input bound to setParty; a datalist only
    // suggests, it does not constrain, so a brand-new household can still be
    // typed. Guard against a regression into a closed dropdown.
    expect(src).toContain('<input value={party} onChange={e => setParty(e.target.value)}')
    expect(src).not.toContain('<select value={party}')
  })
})
