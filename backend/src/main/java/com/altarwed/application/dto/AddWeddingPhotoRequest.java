package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddWeddingPhotoRequest(
        @NotBlank String url,
        @Size(max = 300) String caption,
        Integer sortOrder
) {}
