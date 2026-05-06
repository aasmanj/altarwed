package com.altarwed.web.mapper;

import com.altarwed.application.dto.BudgetItemResponse;
import com.altarwed.domain.model.BudgetItem;
import org.springframework.stereotype.Component;

@Component
public class BudgetItemMapper {

    public BudgetItemResponse toResponse(BudgetItem item) {
        return new BudgetItemResponse(
                item.id(),
                item.coupleId(),
                item.category(),
                item.vendorName(),
                item.estimatedCost(),
                item.actualCost(),
                item.isPaid(),
                item.notes(),
                item.createdAt(),
                item.updatedAt()
        );
    }
}
