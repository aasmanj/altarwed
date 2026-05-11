package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CeremonySectionRequest(
        @NotBlank String title,
        @NotBlank String sectionType,
        String content,
        @NotNull Integer sortOrder
) {}
