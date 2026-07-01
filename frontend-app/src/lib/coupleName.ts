// Display convention across AltarWed: the bride (partnerTwoName) is listed first, matching the
// printed postcards (backend PrintOrderService), the public website, the save-the-date email, and
// the Coming Soon page. Keeping this in one place stops the postcard preview from drifting back to
// groom-first order. Blank names are filtered out so a couple who has entered only one name still
// renders cleanly, falling back to a placeholder when neither name is set.
export function coupleDisplayName(
  partnerOneName: string | null | undefined,
  partnerTwoName: string | null | undefined,
  fallback = 'Your Names',
): string {
  return [partnerTwoName, partnerOneName].filter(Boolean).join(' & ') || fallback
}
