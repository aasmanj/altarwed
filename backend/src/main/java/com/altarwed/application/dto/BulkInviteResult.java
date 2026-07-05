package com.altarwed.application.dto;

import java.util.List;
import java.util.UUID;

/**
 * Synchronous outcome of a bulk RSVP invite request, returned so the dashboard can
 * summarise how many invites were queued vs skipped and why. Mirrors the reporting
 * shape of {@link SaveTheDateSendResult}: a total sent count plus a per-guest list of
 * the ones that were skipped, each tagged with a stable machine reason the dashboard
 * maps to friendly copy.
 *
 * "sent" means handed to Resend via the existing single-invite path; final
 * delivered/bounced status arrives later via the delivery webhook and surfaces per
 * guest. Boxed types per the DTO convention (a missing count must be distinguishable
 * from zero).
 *
 * Skipping is working-as-designed, not an error: an over-cap, no-email, already
 * responded, or unsubscribed guest is reported here, never thrown, so one bad guest
 * never fails the whole batch.
 */
public record BulkInviteResult(
        Integer sent,
        Integer skipped,
        List<SkippedGuest> skippedGuests,
        // True when this response replays a previously recorded send for the same
        // idempotency key (issue #295): nothing was emailed by THIS request. Per-guest
        // skip details are not persisted in the receipt, so a replay carries counts
        // with an empty skippedGuests list, same trade-off as SaveTheDateSendResult.
        Boolean replayed
) {
    // Stable reason codes shared with the dashboard toast. Kept as plain strings (not an
    // enum) so they serialise cleanly and the frontend can map them to copy without a
    // second round-trip.
    public static final String REASON_NO_EMAIL = "no_email";
    public static final String REASON_ALREADY_RESPONDED = "already_responded";
    public static final String REASON_CAP_REACHED = "cap_reached";
    public static final String REASON_UNSUBSCRIBED = "unsubscribed";

    public record SkippedGuest(UUID guestId, String name, String reason) {}
}
