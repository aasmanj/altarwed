package com.altarwed.application.dto;

import com.altarwed.domain.model.CustomQuestionType;
import jakarta.validation.constraints.Size;

import java.util.List;

// All fields optional: null means "leave unchanged". For options, a non-null list
// replaces the stored choices (an empty list clears them).
public record UpdateCustomQuestionRequest(
        @Size(max = 300) String questionText,
        CustomQuestionType type,
        List<@Size(max = 200) String> options,
        Boolean required,
        Integer sortOrder,
        Boolean active
) {}
