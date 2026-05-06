package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingPrayer(
        UUID id,
        UUID weddingWebsiteId,
        String guestName,
        String prayerText,
        LocalDateTime createdAt
) {}
