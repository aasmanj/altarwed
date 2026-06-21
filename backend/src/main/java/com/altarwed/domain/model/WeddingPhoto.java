package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingPhoto(
        UUID id,
        UUID weddingWebsiteId,
        String url,
        String caption,
        int sortOrder,
        LocalDateTime createdAt,
        // Non-destructive framing (see V70). focalPointX/Y are 0.0-1.0 and map to CSS
        // object-position; zoom is a scale factor >= 1.0. All null = centered, no zoom
        // (the original image, unframed). The uploaded file is never modified.
        Double focalPointX,
        Double focalPointY,
        Double zoom
) {}
