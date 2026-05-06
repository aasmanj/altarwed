package com.altarwed.application.dto;

import com.altarwed.domain.model.BudgetCategory;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record BudgetItemResponse(
        UUID id,
        UUID coupleId,
        BudgetCategory category,
        String vendorName,
        BigDecimal estimatedCost,
        BigDecimal actualCost,
        boolean isPaid,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
