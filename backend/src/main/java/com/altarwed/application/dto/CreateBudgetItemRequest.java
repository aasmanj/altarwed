package com.altarwed.application.dto;

import com.altarwed.domain.model.BudgetCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateBudgetItemRequest(
        @NotNull BudgetCategory category,
        @NotBlank @Size(max = 200) String vendorName,
        @NotNull @DecimalMin("0.00") BigDecimal estimatedCost,
        @DecimalMin("0.00") BigDecimal actualCost,
        boolean isPaid,
        @Size(max = 500) String notes
) {}
