import { describe, it, expect } from 'vitest'
import { ADMIN_EMAILS, isAdminEmail } from './admin'

// These assertions encode the /admin/metrics route guard's decision. AdminRoute
// redirects to /dashboard whenever isAdminEmail() is false, so "false for a
// non-admin" is the behavioral guarantee that a logged-in couple or vendor can
// never reach the founder metrics shell, and "true for the admin" is the
// guarantee that Jordan still gets in.
describe('isAdminEmail', () => {
  it('accepts an email on the admin whitelist', () => {
    expect(isAdminEmail('aasmanj@gmail.com')).toBe(true)
  })

  it('is case-insensitive so a differently-cased admin email still matches', () => {
    expect(isAdminEmail('AASMANJ@Gmail.com')).toBe(true)
  })

  it('rejects a non-admin couple or vendor email', () => {
    expect(isAdminEmail('couple@example.com')).toBe(false)
    expect(isAdminEmail('vendor@example.com')).toBe(false)
  })

  it('treats null, undefined, and empty string as non-admin', () => {
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })

  it('does not admit a near-miss that merely contains the admin email', () => {
    expect(isAdminEmail('aasmanj@gmail.com.attacker.com')).toBe(false)
    expect(isAdminEmail('notaasmanj@gmail.com')).toBe(false)
  })

  it('keeps the whitelist in sync with a single known founder entry', () => {
    // Guards against an accidental widening of the whitelist. Update this when a
    // founder is intentionally added (and the backend whitelist alongside it).
    expect(ADMIN_EMAILS).toEqual(['aasmanj@gmail.com'])
  })
})
