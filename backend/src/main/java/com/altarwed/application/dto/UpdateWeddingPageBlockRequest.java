package com.altarwed.application.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// Only content is editable on an existing block; to change type/tab, delete and re-create.
public record UpdateWeddingPageBlockRequest(
        @NotNull @Size(max = 50_000) String contentJson
) {}
