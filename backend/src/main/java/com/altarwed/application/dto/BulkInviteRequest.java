package com.altarwed.application.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * Body for the bulk RSVP invite endpoint: the guest ids the couple selected to
 * invite in one action. Capped at 500 per request (same ceiling as bulk import)
 * so a single call cannot queue an unbounded number of emails.
 *
 * The ids are only a target list, not an assertion that every one is eligible.
 * The service applies the skip rules (no email, already responded, cap reached,
 * unsubscribed) per guest and reports the outcome; the caller does not decide
 * eligibility client-side.
 */
public record BulkInviteRequest(
        @NotEmpty @Size(max = 500) List<UUID> guestIds
) {}
