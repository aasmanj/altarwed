package com.altarwed.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingPrayerResponse(
        UUID id,
        String guestName,
        String prayerText,
        LocalDateTime createdAt
) {}
