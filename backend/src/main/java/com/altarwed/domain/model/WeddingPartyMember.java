package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record WeddingPartyMember(
        UUID id,
        UUID weddingWebsiteId,
        String name,
        String role,
        WeddingPartySide side,
        String bio,
        String photoUrl,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        // Non-destructive framing for the avatar (see V70). focalPointX/Y are 0.0-1.0
        // (CSS object-position), zoom is a scale factor >= 1.0. All null = centered, no
        // zoom. The uploaded file is never modified, so the couple can re-frame any time.
        Double focalPointX,
        Double focalPointY,
        Double zoom
) {}
