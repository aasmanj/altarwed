package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record Vendor(
        UUID id,
        String businessName,
        VendorCategory category,
        String city,
        String state,
        String email,
        String passwordHash,
        boolean isChristianOwned,
        List<UUID> denominationIds,
        boolean isActive,
        boolean isVerified,
        // V25: rough price indicator. Nullable; valid values are "$", "$$", "$$$"
        // enforced by a DB CHECK constraint.
        String priceTier,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public Vendor withVerified() {
        return new Vendor(id, businessName, category, city, state, email, passwordHash,
                isChristianOwned, denominationIds, isActive, true, priceTier, createdAt, LocalDateTime.now());
    }

    public Vendor deactivated() {
        return new Vendor(id, businessName, category, city, state, email, passwordHash,
                isChristianOwned, denominationIds, false, isVerified, priceTier, createdAt, LocalDateTime.now());
    }
}
