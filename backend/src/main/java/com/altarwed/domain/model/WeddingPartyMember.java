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
        LocalDateTime updatedAt
) {}
