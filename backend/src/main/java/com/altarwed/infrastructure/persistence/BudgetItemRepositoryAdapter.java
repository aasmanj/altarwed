package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.BudgetCategory;
import com.altarwed.domain.model.BudgetItem;
import com.altarwed.domain.port.BudgetItemRepository;
import com.altarwed.infrastructure.persistence.entity.BudgetItemEntity;
import com.altarwed.infrastructure.persistence.repository.BudgetItemJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class BudgetItemRepositoryAdapter implements BudgetItemRepository {

    private final BudgetItemJpaRepository jpa;

    public BudgetItemRepositoryAdapter(BudgetItemJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public BudgetItem save(BudgetItem item) {
        return toDomain(jpa.save(toEntity(item)));
    }

    @Override
    public List<BudgetItem> findAllByCoupleId(UUID coupleId) {
        return jpa.findAllByCoupleIdOrderByCreatedAtAsc(coupleId)
                  .stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<BudgetItem> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public void deleteById(UUID id) {
        jpa.deleteById(id);
    }

    @Override
    public boolean existsByIdAndCoupleId(UUID id, UUID coupleId) {
        return jpa.existsByIdAndCoupleId(id, coupleId);
    }

    private BudgetItem toDomain(BudgetItemEntity e) {
        return new BudgetItem(
                e.getId(),
                e.getCoupleId(),
                BudgetCategory.valueOf(e.getCategory()),
                e.getVendorName(),
                e.getEstimatedCost(),
                e.getActualCost(),
                e.isPaid(),
                e.getNotes(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }

    private BudgetItemEntity toEntity(BudgetItem item) {
        return BudgetItemEntity.builder()
                .id(item.id())
                .coupleId(item.coupleId())
                .category(item.category().name())
                .vendorName(item.vendorName())
                .estimatedCost(item.estimatedCost())
                .actualCost(item.actualCost())
                .isPaid(item.isPaid())
                .notes(item.notes())
                .createdAt(item.createdAt())
                .updatedAt(item.updatedAt())
                .build();
    }
}
