package com.altarwed.application.dto;

import com.altarwed.domain.model.VendorCategory;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record UpdateVendorRequest(
        @Size(max = 200) String businessName,
        VendorCategory category,
        @Size(max = 100) String city,
        @Size(max = 50) String state,
        Boolean isChristianOwned,
        List<UUID> denominationIds
) {}
