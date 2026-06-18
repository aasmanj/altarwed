package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One row in the email delivery log: the outcome of a single outbound email as
 * reported by the Resend webhook. Keyed in storage by {@code resendEmailId} so a
 * later event for the same email updates the same row.
 *
 * guestId / coupleId / emailType come from the tags we attach when sending; they
 * let the dashboard join a delivery outcome back to the guest it was sent to.
 * recipientEmailHash is the SHA-256 of the address (never plaintext), used to add
 * hard bounces and complaints to the suppression list.
 */
public record EmailDelivery(
        UUID id,
        String resendEmailId,
        UUID guestId,
        UUID coupleId,
        String emailType,
        String recipientEmailHash,
        EmailDeliveryStatus status,
        // For bounces: Resend's "Permanent" / "Transient" and a finer subtype
        // (e.g. "Suppressed", "MailboxFull"). Null for non-bounce events.
        String bounceType,
        String bounceSubtype,
        // Provider timestamp of the event this row currently reflects; used to drop
        // out-of-order events that would otherwise overwrite a newer outcome.
        LocalDateTime lastEventAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
