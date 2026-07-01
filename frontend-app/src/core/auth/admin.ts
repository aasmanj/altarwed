// Emails allowed to see founder-only surfaces: the /admin/metrics analytics
// page and the link to it in the couple dashboard header. Authorization is
// enforced server-side via the altarwed.admin.emails whitelist
// (AdminMetricsService.assertAdmin, which 403s any other email), so this
// client-side list is defense-in-depth plus UX only: it redirects non-admins
// away and keeps the founder link out of a regular couple's chrome. Keep this
// list in sync with the backend whitelist when adding a new founder.
export const ADMIN_EMAILS = ['aasmanj@gmail.com']

// Case-insensitive membership check. A null, undefined, or empty email is not
// an admin. Emails are compared lowercased because the whitelist is stored
// lowercase and user-entered emails may differ in case.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}
