package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CeremonySectionRequest(
        // title maps to ceremony_sections.title NVARCHAR(200). Without this cap an over-long title
        // (e.g. a pasted verse) overflowed the column and surfaced as a misleading 409 "record
        // already exists" (DataIntegrityViolationException). @Size makes it a clean 400 instead.
        @NotBlank @Size(max = 200) String title,
        @NotBlank String sectionType,
        // content is stored in an NVARCHAR(MAX) column, but cap it defensively so a runaway paste
        // is a clean validation error rather than an unbounded write.
        @Size(max = 5000) String content,
        @NotNull Integer sortOrder
) {}
