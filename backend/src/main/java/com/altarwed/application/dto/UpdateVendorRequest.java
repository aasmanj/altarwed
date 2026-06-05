package com.altarwed.application.dto;

import com.altarwed.domain.model.VendorCategory;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record UpdateVendorRequest(
        @Size(max = 200) String businessName,
        VendorCategory category,
        @Size(max = 100) String city,
        @Size(max = 50) String state,
        Boolean isChristianOwned,
        List<UUID> denominationIds,
        // Validation echoes the DB CHECK constraint added in V25.
        @Pattern(regexp = "^(\\$|\\$\\$|\\$\\$\\$)?$") String priceTier,
        @Size(max = 1000) String bio,
        @Size(max = 2000) String description,
        @Size(max = 500) @Pattern(regexp = "^(https?://.*)?$") String websiteUrl,
        @Size(max = 30) String phone
) {}
