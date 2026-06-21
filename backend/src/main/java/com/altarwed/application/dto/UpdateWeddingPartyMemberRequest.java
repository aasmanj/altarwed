package com.altarwed.application.dto;

import com.altarwed.domain.model.WeddingPartySide;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

public record UpdateWeddingPartyMemberRequest(
        @Size(max = 200) String name,
        @Size(max = 100) String role,
        WeddingPartySide side,
        @Size(max = 1000) String bio,
        @Size(max = 500) String photoUrl,
        Integer sortOrder,
        // Non-destructive avatar framing (V70). null leaves the field unchanged; bounds
        // apply only when provided (Bean Validation skips null).
        @DecimalMin("0.0") @DecimalMax("1.0") Double focalPointX,
        @DecimalMin("0.0") @DecimalMax("1.0") Double focalPointY,
        @DecimalMin("1.0") @DecimalMax("3.0") Double zoom
) {}
