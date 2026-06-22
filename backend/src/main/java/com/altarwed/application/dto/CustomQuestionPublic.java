package com.altarwed.application.dto;

import com.altarwed.domain.model.CustomQuestionType;

import java.util.List;
import java.util.UUID;

// The trimmed question view returned to the public RSVP page. No couple id, sort order,
// or active flag, just what the form needs to render and validate the field.
public record CustomQuestionPublic(
        UUID id,
        String questionText,
        CustomQuestionType type,
        List<String> options,
        Boolean required
) {}
