package com.altarwed.application.service;

import com.altarwed.application.dto.BudgetSummaryResponse;
import com.altarwed.application.dto.BudgetItemResponse;
import com.altarwed.application.dto.CreateBudgetItemRequest;
import com.altarwed.application.dto.UpdateBudgetItemRequest;
import com.altarwed.domain.exception.BudgetItemNotFoundException;
import com.altarwed.domain.exception.CoupleNotFoundException;
import com.altarwed.domain.model.BudgetItem;
import com.altarwed.domain.port.BudgetItemRepository;
import com.altarwed.domain.port.CoupleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class BudgetItemService {

    private final BudgetItemRepository budgetItemRepository;
    private final CoupleRepository coupleRepository;

    public BudgetItemService(BudgetItemRepository budgetItemRepository, CoupleRepository coupleRepository) {
        this.budgetItemRepository = budgetItemRepository;
        this.coupleRepository = coupleRepository;
    }

    @Transactional(readOnly = true)
    public BudgetSummaryResponse getSummary(UUID coupleId) {
        coupleRepository.findById(coupleId)
                .orElseThrow(() -> new CoupleNotFoundException(coupleId.toString()));
        List<BudgetItem> items = budgetItemRepository.findAllByCoupleId(coupleId);
        List<BudgetItemResponse> responses = items.stream()
                .map(i -> new BudgetItemResponse(i.id(), i.coupleId(), i.category(), i.vendorName(),
                        i.estimatedCost(), i.actualCost(), i.isPaid(), i.notes(), i.createdAt(), i.updatedAt()))
                .toList();

        BigDecimal totalBudget = items.stream()
                .map(BudgetItem::estimatedCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalActual = items.stream()
                .filter(i -> i.actualCost() != null)
                .map(BudgetItem::actualCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPaid = items.stream()
                .filter(BudgetItem::isPaid)
                .filter(i -> i.actualCost() != null)
                .map(BudgetItem::actualCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRemaining = totalActual.subtract(totalPaid);

        return new BudgetSummaryResponse(totalBudget, totalActual, totalPaid, totalRemaining, responses);
    }

    @Transactional
    public BudgetItem createItem(UUID coupleId, CreateBudgetItemRequest req) {
        coupleRepository.findById(coupleId)
                .orElseThrow(() -> new CoupleNotFoundException(coupleId.toString()));
        BudgetItem item = new BudgetItem(
                null, coupleId, req.category(), req.vendorName(),
                req.estimatedCost(), req.actualCost(), req.isPaid(), req.notes(),
                null, null
        );
        return budgetItemRepository.save(item);
    }

    @Transactional
    public BudgetItem updateItem(UUID coupleId, UUID itemId, UpdateBudgetItemRequest req) {
        BudgetItem existing = budgetItemRepository.findById(itemId)
                .filter(i -> i.coupleId().equals(coupleId))
                .orElseThrow(() -> new BudgetItemNotFoundException(itemId.toString()));

        BudgetItem updated = new BudgetItem(
                existing.id(),
                existing.coupleId(),
                req.category() != null ? req.category() : existing.category(),
                req.vendorName() != null ? req.vendorName() : existing.vendorName(),
                req.estimatedCost() != null ? req.estimatedCost() : existing.estimatedCost(),
                req.actualCost() != null ? req.actualCost() : existing.actualCost(),
                req.isPaid() != null ? req.isPaid() : existing.isPaid(),
                req.notes() != null ? req.notes() : existing.notes(),
                existing.createdAt(),
                null
        );
        return budgetItemRepository.save(updated);
    }

    @Transactional
    public void deleteItem(UUID coupleId, UUID itemId) {
        if (!budgetItemRepository.existsByIdAndCoupleId(itemId, coupleId)) {
            throw new BudgetItemNotFoundException(itemId.toString());
        }
        budgetItemRepository.deleteById(itemId);
    }
}
