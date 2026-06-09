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
        LocalDate engagementDate,

        String heroPhotoUrl,
        String heroTagline,
        // V57: hero focal point (0.0–1.0 range, maps to CSS object-position). null = center.
        Double heroFocalPointX,
        Double heroFocalPointY,
        // V57: CSS color string for the tagline text. null = white.
        String heroTaglineColor,

        String ourStory,
        String scriptureReference,
        String scriptureText,
        // V57: translation code (e.g. "ESV", "NIV"). null = unset.
        String scriptureTranslation,

        String venueName,
        String venueAddress,
        String venueCity,
        String venueState,
        String ceremonyTime,
        String dressCode,
        // V58: optional venue photo and additional info.
        String venuePhotoUrl,
        String venueAdditionalInfo,

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
        String hiddenTabs,
        String customTabLabels,

        // V59: CSS color string for the site's accent color. null = default gold.
        String accentColor,

        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
