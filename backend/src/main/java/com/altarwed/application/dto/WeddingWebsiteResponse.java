package com.altarwed.application.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingWebsiteResponse(
        UUID id,
        UUID coupleId,
        String slug,
        boolean isPublished,

        String partnerOneName,
        String partnerTwoName,
        LocalDate weddingDate,

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

        BigDecimal goalBudget,

        // V34: tab visibility + custom labels. Both opaque strings; frontend parses.
        // hiddenTabs       = CSV of BlockTab enum names (e.g. "REGISTRY,TRAVEL")
        // customTabLabels  = JSON map (e.g. {"TRAVEL":"Hotels & flights"})
        String hiddenTabs,
        String customTabLabels,

        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
