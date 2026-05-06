package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record SeatingTable(
        UUID id,
        UUID coupleId,
        String name,
        int capacity,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
