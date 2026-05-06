package com.altarwed.domain.port;

import com.altarwed.domain.model.BudgetItem;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BudgetItemRepository {
    BudgetItem save(BudgetItem item);
    List<BudgetItem> findAllByCoupleId(UUID coupleId);
    Optional<BudgetItem> findById(UUID id);
    void deleteById(UUID id);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
}
