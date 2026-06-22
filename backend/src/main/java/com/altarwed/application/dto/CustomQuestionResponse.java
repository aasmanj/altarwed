package com.altarwed.application.dto;

import com.altarwed.domain.model.CustomQuestionType;

import java.util.List;
import java.util.UUID;

// Full question view for the couple's editor.
public record CustomQuestionResponse(
        UUID id,
        UUID coupleId,
        String questionText,
        CustomQuestionType type,
        List<String> options,
        Boolean required,
        Integer sortOrder,
        Boolean active
) {}
