package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.BudgetItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BudgetItemJpaRepository extends JpaRepository<BudgetItemEntity, UUID> {
    List<BudgetItemEntity> findAllByCoupleIdOrderByCreatedAtAsc(UUID coupleId);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
}
