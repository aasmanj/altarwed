package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One guest's answer to one custom RSVP question. Stored against the guest who submitted
 * the RSVP (household-level), one row per (question, guest).
 */
public record CustomRsvpAnswer(
        UUID id,
        UUID questionId,
        UUID guestId,
        String answerText,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
