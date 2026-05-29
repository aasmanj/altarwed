package com.altarwed.application.dto;

import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

// All fields nullable, only non-null fields are applied (patch semantics).
public record UpdateWeddingWebsiteRequest(

        @Size(max = 100) String partnerOneName,
        @Size(max = 100) String partnerTwoName,
        LocalDate weddingDate,

        @Size(max = 500) String heroPhotoUrl,
        @Size(max = 200) String heroTagline,
        String ourStory,
        @Size(max = 200) String scriptureReference,
        String scriptureText,

        @Size(max = 200) String venueName,
        @Size(max = 300) String venueAddress,
        @Size(max = 100) String venueCity,
        @Size(max = 50)  String venueState,
        @Size(max = 50)  String ceremonyTime,
        @Size(max = 100) String dressCode,

        @Size(max = 200) String hotelName,
        @Size(max = 500) String hotelUrl,
        String hotelDetails,

        @Size(max = 500) String registryUrl1,
        @Size(max = 100) String registryLabel1,
        @Size(max = 500) String registryUrl2,
        @Size(max = 100) String registryLabel2,
        @Size(max = 500) String registryUrl3,
        @Size(max = 100) String registryLabel3,

        LocalDate rsvpDeadline,

        String partnerOneVows,
        String partnerTwoVows,

        BigDecimal goalBudget,

        // V34: opaque CSV / JSON. Frontend builds them; backend never inspects.
        // Length caps generous enough for all 8 tabs + custom labels.
        @Size(max = 500)   String hiddenTabs,
        @Size(max = 4000)  String customTabLabels
) {}
