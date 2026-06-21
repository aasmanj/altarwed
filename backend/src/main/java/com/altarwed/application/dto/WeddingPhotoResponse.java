package com.altarwed.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingPhotoResponse(
        UUID id,
        UUID weddingWebsiteId,
        String url,
        String caption,
        int sortOrder,
        LocalDateTime createdAt,
        // Framing for non-destructive crop/recenter (V70). null = centered / no zoom.
        Double focalPointX,
        Double focalPointY,
        Double zoom
) {}
