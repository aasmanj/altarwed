package com.altarwed.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingPhotoResponse(
        UUID id,
        UUID weddingWebsiteId,
        String url,
        String caption,
        int sortOrder,
        LocalDateTime createdAt
) {}
