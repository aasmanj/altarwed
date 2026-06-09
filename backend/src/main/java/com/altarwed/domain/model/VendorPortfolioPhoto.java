package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record VendorPortfolioPhoto(
        UUID id,
        UUID vendorId,
        String photoUrl,
        String caption,
        int sortOrder,
        LocalDateTime createdAt
) {}
