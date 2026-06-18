package com.altarwed.application.dto;

import java.util.List;
import java.util.UUID;

/**
 * Synchronous outcome of a save-the-date send request, returned so the dashboard
 * can (1) pop up the exact addresses the couple must fix before they will send, and
 * (2) summarise how many were queued vs skipped and why.
 *
 * "queued" means handed to Resend; final delivered/bounced counts arrive later via
 * the delivery webhook (see EmailDeliveryService) and surface per guest. Boxed types
 * per the DTO convention (a missing count must be distinguishable from zero).
 */
public record SaveTheDateSendResult(
        Integer queued,
        Integer invalidCount,
        Integer suppressedCount,
        List<InvalidGuestEmail> invalidEmails
) {
    public record InvalidGuestEmail(UUID guestId, String name, String email) {}
}
