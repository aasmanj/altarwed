package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record PlanningTask(
        UUID id,
        UUID coupleId,
        String title,
        PlanningTaskCategory category,
        Integer dueMonthsBefore,
        boolean isCompleted,
        LocalDateTime completedAt,
        boolean isSeeded,
        int sortOrder,
        String notes,
        String assignee,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
