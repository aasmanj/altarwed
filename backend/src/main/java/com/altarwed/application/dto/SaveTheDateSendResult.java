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
 *
 * {@code replayed} is true when this response is an idempotent replay of an earlier send
 * (issue #232): the couple retried with the same client key, so nothing was re-emailed and
 * the counts are the original send's. On a replay {@code invalidEmails} is empty (the
 * detail list is not persisted with the receipt); the counts still summarise the outcome.
 */
public record SaveTheDateSendResult(
        Integer queued,
        Integer invalidCount,
        Integer suppressedCount,
        List<InvalidGuestEmail> invalidEmails,
        Boolean replayed
) {
    public record InvalidGuestEmail(UUID guestId, String name, String email) {}
}
