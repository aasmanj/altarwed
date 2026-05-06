package com.altarwed.application.dto;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

// All fields nullable — only non-null fields are applied (patch semantics).
// websitePin: null = don't change, empty string = clear pin, non-empty = set pin.
public record UpdateWeddingWebsiteRequest(

        @Size(max = 100) String partnerOneName,
        @Size(max = 100) String partnerTwoName,
        LocalDate weddingDate,

        @Size(max = 500) String heroPhotoUrl,
        String ourStory,
        String testimony,
        String covenantStatement,
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

        @Size(max = 10) String websitePin
) {}
