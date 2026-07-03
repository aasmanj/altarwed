package com.altarwed.application.dto;

import java.util.List;
import java.util.UUID;

/**
 * Issue #59: the create endpoint now returns 202 with a Stripe Checkout URL to redirect the
 * couple to (null on an idempotent replay, since the couple's client already has the original
 * URL from the first response), plus non-blocking warnings (e.g. duplicate addresses) and the
 * list of guests excluded before any charge (bad address, ownership mismatch).
 */
public record PrintOrderCreateResponse(
        PrintOrderResponse order,
        String checkoutUrl,
        List<String> warnings,
        List<ExcludedGuest> excludedGuests
) {
    public record ExcludedGuest(UUID guestId, String guestName, String reason) {}
}
