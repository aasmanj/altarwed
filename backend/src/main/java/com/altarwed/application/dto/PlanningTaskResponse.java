package com.altarwed.application.dto;

import com.altarwed.domain.model.PlanningTaskCategory;

import java.time.LocalDateTime;
import java.util.UUID;

public record PlanningTaskResponse(
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
