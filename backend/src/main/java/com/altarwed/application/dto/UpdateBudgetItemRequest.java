package com.altarwed.application.dto;

import com.altarwed.domain.model.BudgetCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateBudgetItemRequest(
        BudgetCategory category,
        @Size(max = 200) String vendorName,
        @DecimalMin("0.00") BigDecimal estimatedCost,
        @DecimalMin("0.00") BigDecimal actualCost,
        Boolean isPaid,
        @Size(max = 500) String notes
) {}
