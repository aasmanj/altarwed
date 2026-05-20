package com.altarwed.application.dto;

public record UpdatePlanningTaskRequest(
        Boolean isCompleted,
        // null means "leave unchanged"; empty string means "clear the field".
        String notes,
        String assignee
) {}
