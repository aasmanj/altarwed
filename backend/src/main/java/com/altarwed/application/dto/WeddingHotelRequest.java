package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WeddingHotelRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 500) String address,
        @Size(max = 1000) String bookingUrl,
        @Size(max = 300) String blockRate,
        // Optional manual override for driving distance from the venue.
        // Automatically computed when GOOGLE_MAPS_API_KEY is configured.
        @Size(max = 100) String distanceFromVenue,
        Integer sortOrder
) {}
