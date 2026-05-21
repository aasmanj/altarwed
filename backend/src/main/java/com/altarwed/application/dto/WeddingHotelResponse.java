package com.altarwed.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingHotelResponse(
        UUID id,
        UUID websiteId,
        String name,
        String address,
        String bookingUrl,
        String blockRate,
        String distanceFromVenue,
        Integer sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
