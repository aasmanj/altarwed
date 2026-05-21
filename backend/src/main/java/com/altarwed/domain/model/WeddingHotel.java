package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingHotel(
        UUID id,
        UUID websiteId,
        String name,
        String address,
        String bookingUrl,
        String blockRate,
        // Driving distance from the venue, e.g. "2.3 miles". May be null if not computed.
        String distanceFromVenue,
        Integer sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
