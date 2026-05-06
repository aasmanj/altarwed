package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingPhoto(
        UUID id,
        UUID weddingWebsiteId,
        String url,
        String caption,
        int sortOrder,
        LocalDateTime createdAt
) {}
