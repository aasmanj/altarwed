package com.altarwed.application.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

// Slug endpoint DTO (GET /api/v1/wedding-websites/slug/{slug}) is served to anonymous guests.
// Omits coupleId and goalBudget: internal identifiers and private planning data have no
// business in a public payload. See WeddingWebsiteResponse for the owner-facing shape.
public record PublicWeddingWebsiteResponse(
        UUID id,
        String slug,
        boolean isPublished,

        String partnerOneName,
        String partnerTwoName,
        LocalDate weddingDate,
        LocalDate engagementDate,

        String heroPhotoUrl,
        String heroTagline,
        Double heroFocalPointX,
        Double heroFocalPointY,
        String heroTaglineColor,

        String ourStory,
        String scriptureReference,
        String scriptureText,
        String scriptureTranslation,

        String venueName,
        String venueAddress,
        String venueCity,
        String venueState,
        String ceremonyTime,
        String dressCode,
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

        String hiddenTabs,
        String customTabLabels,

        String accentColor,
        String scriptureBackgroundColor,

        String stdImageUrl,

        // V90: reception venue (venue* above is the ceremony venue) + optional card titles.
        String receptionVenueName,
        String receptionVenueAddress,
        String receptionVenueCity,
        String receptionVenueState,
        String receptionTime,
        String receptionVenueAdditionalInfo,
        String ceremonyVenueTitle,
        String receptionVenueTitle,

        // V91: allowlisted font key for the couple's names. null = default serif.
        String nameFont,

        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
