package com.altarwed.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record CeremonySectionResponse(
        UUID id,
        UUID coupleId,
        String title,
        String sectionType,
        String content,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
