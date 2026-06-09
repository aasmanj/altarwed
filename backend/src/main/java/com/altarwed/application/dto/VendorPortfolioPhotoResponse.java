package com.altarwed.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record VendorPortfolioPhotoResponse(
        UUID id,
        String photoUrl,
        String caption,
        Integer sortOrder,
        LocalDateTime createdAt
) {}
