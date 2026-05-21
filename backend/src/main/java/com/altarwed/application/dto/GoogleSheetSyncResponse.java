package com.altarwed.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record GoogleSheetSyncResponse(
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
