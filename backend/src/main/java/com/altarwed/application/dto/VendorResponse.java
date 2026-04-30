package com.altarwed.application.dto;

import com.altarwed.domain.model.VendorCategory;

import java.util.List;
import java.util.UUID;

public record VendorResponse(
        UUID id,
        String businessName,
        VendorCategory category,
        String city,
        String state,
        String email,
        boolean isChristianOwned,
        List<UUID> denominationIds,
        boolean isVerified
) {}
