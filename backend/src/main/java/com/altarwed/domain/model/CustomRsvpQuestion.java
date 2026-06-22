package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * A couple-defined question shown on the public RSVP form and answered once per
 * submission by the responding guest. {@code options} holds the choices for a CHOICE
 * question and is empty for TEXT and YES_NO. Inactive questions are kept (so existing
 * answers are not orphaned) but no longer shown on the RSVP form.
 */
public record CustomRsvpQuestion(
        UUID id,
        UUID coupleId,
        String questionText,
        CustomQuestionType type,
        List<String> options,
        boolean required,
        int sortOrder,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
