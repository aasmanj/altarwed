package com.altarwed.application.dto;

import com.altarwed.domain.model.VendorCategory;

import java.util.List;
import java.util.UUID;

public record VendorProfileResponse(
        UUID id,
        String email,
        String businessName,
        VendorCategory category,
        String city,
        String state,
        Boolean isChristianOwned,
        List<UUID> denominationIds,
        Boolean isVerified,
        // Listing visibility toggle (pause/resume). False = paused: hidden from the directory and
        // not accepting new inquiries. Independent of isVerified (subscription state).
        Boolean isActive,
        String priceTier,
        String bio,
        String description,
        String websiteUrl,
        String phone,
        String logoUrl,
        String contactEmail
) {}
