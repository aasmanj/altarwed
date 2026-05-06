package com.altarwed.application.dto;

import com.altarwed.domain.model.PlanningTaskCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreatePlanningTaskRequest(
        @NotBlank @Size(max = 300) String title,
        @NotNull PlanningTaskCategory category,
        Integer dueMonthsBefore
) {}
