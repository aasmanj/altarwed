package com.altarwed.application.dto;

import java.math.BigDecimal;
import java.util.List;

public record BudgetSummaryResponse(
        BigDecimal totalBudget,
        BigDecimal totalActual,
        BigDecimal totalPaid,
        BigDecimal totalRemaining,
        List<BudgetItemResponse> items
) {}
