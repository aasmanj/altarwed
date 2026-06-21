package com.altarwed.application.dto;

import com.altarwed.domain.model.WeddingPartySide;

import java.util.UUID;

public record WeddingPartyMemberResponse(
        UUID id,
        UUID weddingWebsiteId,
        String name,
        String role,
        WeddingPartySide side,
        String bio,
        String photoUrl,
        int sortOrder,
        // Avatar framing for non-destructive crop/recenter (V70). null = centered / no zoom.
        Double focalPointX,
        Double focalPointY,
        Double zoom
) {}
