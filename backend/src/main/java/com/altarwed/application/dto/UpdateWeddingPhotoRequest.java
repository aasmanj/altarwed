package com.altarwed.application.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

public record UpdateWeddingPhotoRequest(
        @Size(max = 300) String caption,
        Integer sortOrder,
        // Non-destructive framing (V70). Boxed + nullable: null leaves the field
        // unchanged. Bean Validation skips null, so bounds apply only when provided.
        @DecimalMin("0.0") @DecimalMax("1.0") Double focalPointX,
        @DecimalMin("0.0") @DecimalMax("1.0") Double focalPointY,
        @DecimalMin("1.0") @DecimalMax("5.0") Double zoom
) {}
