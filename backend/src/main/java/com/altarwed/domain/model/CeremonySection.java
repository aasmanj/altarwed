package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record CeremonySection(
        UUID id,
        UUID coupleId,
        String title,
        String sectionType,
        String content,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
