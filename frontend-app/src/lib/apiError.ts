// Shared extractor for the human-readable reason on a failed API call.
//
// Spring serializes service-level rejections as RFC 7807 ProblemDetail
// (application/problem+json) with the reason in `detail` (a @Size validation
// limit, a business-rule conflict, and so on). Surfacing that verbatim tells the
// couple the real cause instead of a generic failure. When the failure carries
// no ProblemDetail (a network blip or a 5xx), fall back to a friendly default.
//
// This mirrors the inline `err.response.data.detail` reads scattered across the
// couple features (GuestListPage send-invite, WeddingWebsiteSetup, PromoCodeBox)
// so every per-hook onError surfaces the same field the same way.
export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export function errorDetail(err: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim().length > 0) return detail
  return fallback
}
