package com.altarwed.application.dto;

import jakarta.validation.constraints.Size;

public record UpdateWeddingPhotoRequest(
        @Size(max = 300) String caption,
        Integer sortOrder
) {}
