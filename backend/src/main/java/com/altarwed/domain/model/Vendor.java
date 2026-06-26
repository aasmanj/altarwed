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
        // V49: profile-enrichment fields, all nullable at registration
        String bio,
        String description,
        String websiteUrl,
        String phone,
        // V51: optional logo, stored in Azure Blob
        String logoUrl,
        // V56: profile view counter; incremented on each public GET /vendors/{id}
        Integer viewCount,
        // V60: optional public contact email, distinct from login email
        String contactEmail,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public Vendor withVerified() {
        return new Vendor(id, businessName, category, city, state, email, passwordHash,
                isChristianOwned, denominationIds, isActive, true, priceTier,
                bio, description, websiteUrl, phone, logoUrl, viewCount, contactEmail, createdAt, LocalDateTime.now());
    }

    public Vendor withUnverified() {
        return new Vendor(id, businessName, category, city, state, email, passwordHash,
                isChristianOwned, denominationIds, isActive, false, priceTier,
                bio, description, websiteUrl, phone, logoUrl, viewCount, contactEmail, createdAt, LocalDateTime.now());
    }

    public Vendor withPasswordHash(String newHash) {
        return new Vendor(id, businessName, category, city, state, email, newHash,
                isChristianOwned, denominationIds, isActive, isVerified, priceTier,
                bio, description, websiteUrl, phone, logoUrl, viewCount, contactEmail, createdAt, LocalDateTime.now());
    }

    public Vendor withLogoUrl(String url) {
        return new Vendor(id, businessName, category, city, state, email, passwordHash,
                isChristianOwned, denominationIds, isActive, isVerified, priceTier,
                bio, description, websiteUrl, phone, url, viewCount, contactEmail, createdAt, LocalDateTime.now());
    }

    // Vendor-controlled "pause/resume listing". isActive is the directory-visibility + accepting-
    // inquiries gate (findAllActive requires it; VendorInquiryService blocks inquiries without it)
    // and is independent of isVerified (subscription state), so pausing never fights the Stripe
    // webhooks and never affects login. Pause = false, resume = true.
    public Vendor withListingActive(boolean active) {
        return new Vendor(id, businessName, category, city, state, email, passwordHash,
                isChristianOwned, denominationIds, active, isVerified, priceTier,
                bio, description, websiteUrl, phone, logoUrl, viewCount, contactEmail, createdAt, LocalDateTime.now());
    }
}
