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
        // V57: focal point for the hero image (0.0–1.0 range, maps to CSS object-position).
        // null = use center (0.5, 0.5).
        Double heroFocalPointX,
        Double heroFocalPointY,
        // V57: CSS color string for the tagline text (e.g. "#ffffff"). null = white.
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
        // V58: optional venue photo and free-form additional info (parking, etc.)
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

        // V59: CSS color string for the site's accent color (e.g. "#d4af6a").
        // null = use the default AltarWed gold.
        String accentColor,

        // V62: CSS color string for the scripture banner background (e.g. "#1a1a2e").
        // null = use the default dark gradient.
        String scriptureBackgroundColor,

        // V65: custom save-the-date image URL (couple uploads a Canva PNG, etc.).
        // null = use the default text-only STD email template.
        String stdImageUrl,

        // V90: reception venue. The existing venue* fields above are the CEREMONY
        // venue; these hold a genuinely separate reception location. All null = the
        // couple has no distinct reception venue (only the ceremony card renders).
        String receptionVenueName,
        String receptionVenueAddress,
        String receptionVenueCity,
        String receptionVenueState,
        String receptionTime,
        String receptionVenueAdditionalInfo,
        // V90: optional custom headers for the two venue cards (e.g. "Ceremony",
        // "Reception", "The Blessing"). null = the UI falls back to its default label.
        String ceremonyVenueTitle,
        String receptionVenueTitle,

        // V91: font key for the couple's names on the public hero. Allowlisted key
        // (e.g. "playfair"|"cormorant"|"greatvibes"|"montserrat"), never a raw
        // font-family. null = the default serif (Playfair).
        String nameFont,

        // V92: optional custom headline on the printable seating board. null = "Welcome".
        String seatingBoardTitle,

        // V96: hero presentation controls (issue #360).
        // heroOverlayDarkness: 0-100 intensity of the dark scrim drawn over the hero photo so
        // the white couple names stay legible on bright photos. null = the default (70). The
        // value is clamped to [0,100] at the DTO boundary; the public renderer derives the
        // gradient alpha stops from the clamped integer, never a raw string.
        Integer heroOverlayDarkness,
        // heroLayout: how the hero photo fills its section. "full" = full-bleed cover crop
        // (default), "framed" = contain the whole photo so portrait heroes are not cropped
        // hard. null = "full". Allowlisted key, never a raw CSS value.
        String heroLayout,

        boolean isDeleted,
        LocalDateTime deletedAt,

        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public WeddingWebsite published() {
        return new WeddingWebsite(id, coupleId, slug, true,
                partnerOneName, partnerTwoName, weddingDate, engagementDate,
                heroPhotoUrl, heroTagline, heroFocalPointX, heroFocalPointY, heroTaglineColor,
                ourStory, scriptureReference, scriptureText, scriptureTranslation,
                venueName, venueAddress, venueCity, venueState, ceremonyTime, dressCode,
                venuePhotoUrl, venueAdditionalInfo,
                hotelName, hotelUrl, hotelDetails,
                registryUrl1, registryLabel1, registryUrl2, registryLabel2, registryUrl3, registryLabel3,
                rsvpDeadline, partnerOneVows, partnerTwoVows, goalBudget,
                hiddenTabs, customTabLabels, accentColor, scriptureBackgroundColor,
                stdImageUrl,
                receptionVenueName, receptionVenueAddress, receptionVenueCity, receptionVenueState,
                receptionTime, receptionVenueAdditionalInfo, ceremonyVenueTitle, receptionVenueTitle,
                nameFont, seatingBoardTitle,
                heroOverlayDarkness, heroLayout,
                isDeleted, deletedAt, createdAt, LocalDateTime.now());
    }

    public WeddingWebsite unpublished() {
        return new WeddingWebsite(id, coupleId, slug, false,
                partnerOneName, partnerTwoName, weddingDate, engagementDate,
                heroPhotoUrl, heroTagline, heroFocalPointX, heroFocalPointY, heroTaglineColor,
                ourStory, scriptureReference, scriptureText, scriptureTranslation,
                venueName, venueAddress, venueCity, venueState, ceremonyTime, dressCode,
                venuePhotoUrl, venueAdditionalInfo,
                hotelName, hotelUrl, hotelDetails,
                registryUrl1, registryLabel1, registryUrl2, registryLabel2, registryUrl3, registryLabel3,
                rsvpDeadline, partnerOneVows, partnerTwoVows, goalBudget,
                hiddenTabs, customTabLabels, accentColor, scriptureBackgroundColor,
                stdImageUrl,
                receptionVenueName, receptionVenueAddress, receptionVenueCity, receptionVenueState,
                receptionTime, receptionVenueAdditionalInfo, ceremonyVenueTitle, receptionVenueTitle,
                nameFont, seatingBoardTitle,
                heroOverlayDarkness, heroLayout,
                isDeleted, deletedAt, createdAt, LocalDateTime.now());
    }

    public WeddingWebsite deleted() {
        return new WeddingWebsite(id, coupleId, slug, false,
                partnerOneName, partnerTwoName, weddingDate, engagementDate,
                heroPhotoUrl, heroTagline, heroFocalPointX, heroFocalPointY, heroTaglineColor,
                ourStory, scriptureReference, scriptureText, scriptureTranslation,
                venueName, venueAddress, venueCity, venueState, ceremonyTime, dressCode,
                venuePhotoUrl, venueAdditionalInfo,
                hotelName, hotelUrl, hotelDetails,
                registryUrl1, registryLabel1, registryUrl2, registryLabel2, registryUrl3, registryLabel3,
                rsvpDeadline, partnerOneVows, partnerTwoVows, goalBudget,
                hiddenTabs, customTabLabels, accentColor, scriptureBackgroundColor,
                stdImageUrl,
                receptionVenueName, receptionVenueAddress, receptionVenueCity, receptionVenueState,
                receptionTime, receptionVenueAdditionalInfo, ceremonyVenueTitle, receptionVenueTitle,
                nameFont, seatingBoardTitle,
                heroOverlayDarkness, heroLayout,
                true, LocalDateTime.now(), createdAt, LocalDateTime.now());
    }
}
