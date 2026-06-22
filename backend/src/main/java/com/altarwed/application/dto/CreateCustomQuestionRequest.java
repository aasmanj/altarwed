package com.altarwed.application.dto;

import com.altarwed.domain.model.CustomQuestionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateCustomQuestionRequest(
        @NotBlank @Size(max = 300) String questionText,
        @NotNull CustomQuestionType type,
        // Choices for a CHOICE question; ignored for TEXT and YES_NO.
        List<@Size(max = 200) String> options,
        Boolean required
) {}
