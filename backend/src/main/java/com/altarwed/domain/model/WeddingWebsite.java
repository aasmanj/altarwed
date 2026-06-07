package com.altarwed.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingWebsite(
        UUID id,
        UUID coupleId,
        String slug,
        boolean isPublished,

        String partnerOneName,
        String partnerTwoName,
        LocalDate weddingDate,
        // V53: when the couple got engaged. Used to scale the planning checklist
        // timeline into their actual runway (engagement -> wedding) instead of a
        // fixed 12-month assumption. Optional.
        LocalDate engagementDate,

        String heroPhotoUrl,
        String heroTagline,
        String ourStory,
        String scriptureReference,
        String scriptureText,

        String venueName,
        String venueAddress,
        String venueCity,
        String venueState,
        String ceremonyTime,
        String dressCode,

        String hotelName,
        String hotelUrl,
        String hotelDetails,

        String registryUrl1,
        String registryLabel1,
        String registryUrl2,
        String registryLabel2,
        String registryUrl3,
        String registryLabel3,

        LocalDate rsvpDeadline,

        String partnerOneVows,
        String partnerTwoVows,

        // V25: target total spend the couple is shooting for. Compared against
        // BudgetItem actualCost sums in the budget tracker. Optional.
        BigDecimal goalBudget,

        // V34: tab visibility + custom labels for the public wedding page.
        // Stored as opaque strings end-to-end (backend never inspects them):
        //   hiddenTabs       - CSV of BlockTab enum names, e.g. "REGISTRY,TRAVEL"
        //   customTabLabels  - JSON map, e.g. {"TRAVEL":"Hotels & flights"}
        // The frontend parses both. Treating them as opaque avoids dragging Jackson
        // into the persistence path and keeps the schema migrations simple.
        String hiddenTabs,
        String customTabLabels,

        boolean isDeleted,
        LocalDateTime deletedAt,

        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public WeddingWebsite published() {
        return new WeddingWebsite(id, coupleId, slug, true,
                partnerOneName, partnerTwoName, weddingDate, engagementDate,
                heroPhotoUrl, heroTagline, ourStory,
                scriptureReference, scriptureText,
                venueName, venueAddress, venueCity, venueState, ceremonyTime, dressCode,
                hotelName, hotelUrl, hotelDetails,
                registryUrl1, registryLabel1, registryUrl2, registryLabel2, registryUrl3, registryLabel3,
                rsvpDeadline, partnerOneVows, partnerTwoVows, goalBudget,
                hiddenTabs, customTabLabels,
                isDeleted, deletedAt, createdAt, LocalDateTime.now());
    }

    public WeddingWebsite unpublished() {
        return new WeddingWebsite(id, coupleId, slug, false,
                partnerOneName, partnerTwoName, weddingDate, engagementDate,
                heroPhotoUrl, heroTagline, ourStory,
                scriptureReference, scriptureText,
                venueName, venueAddress, venueCity, venueState, ceremonyTime, dressCode,
                hotelName, hotelUrl, hotelDetails,
                registryUrl1, registryLabel1, registryUrl2, registryLabel2, registryUrl3, registryLabel3,
                rsvpDeadline, partnerOneVows, partnerTwoVows, goalBudget,
                hiddenTabs, customTabLabels,
                isDeleted, deletedAt, createdAt, LocalDateTime.now());
    }

    public WeddingWebsite deleted() {
        return new WeddingWebsite(id, coupleId, slug, false,
                partnerOneName, partnerTwoName, weddingDate, engagementDate,
                heroPhotoUrl, heroTagline, ourStory,
                scriptureReference, scriptureText,
                venueName, venueAddress, venueCity, venueState, ceremonyTime, dressCode,
                hotelName, hotelUrl, hotelDetails,
                registryUrl1, registryLabel1, registryUrl2, registryLabel2, registryUrl3, registryLabel3,
                rsvpDeadline, partnerOneVows, partnerTwoVows, goalBudget,
                hiddenTabs, customTabLabels,
                true, LocalDateTime.now(), createdAt, LocalDateTime.now());
    }
}
