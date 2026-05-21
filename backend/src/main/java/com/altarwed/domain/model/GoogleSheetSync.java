package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record GoogleSheetSync(
        UUID id,
        UUID coupleId,
        String sheetUrl,
        LocalDateTime lastSynced,
        String lastError,
        Integer rowCount,
        boolean isActive,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
