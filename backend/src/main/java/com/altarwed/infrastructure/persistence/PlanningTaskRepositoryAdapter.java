package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.PlanningTask;
import com.altarwed.domain.port.PlanningTaskRepository;
import com.altarwed.infrastructure.persistence.entity.PlanningTaskEntity;
import com.altarwed.infrastructure.persistence.repository.PlanningTaskJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class PlanningTaskRepositoryAdapter implements PlanningTaskRepository {

    private final PlanningTaskJpaRepository jpa;

    public PlanningTaskRepositoryAdapter(PlanningTaskJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public PlanningTask save(PlanningTask task) {
        return toDomain(jpa.save(toEntity(task)));
    }

    @Override
    public List<PlanningTask> saveAll(List<PlanningTask> tasks) {
        return jpa.saveAll(tasks.stream().map(this::toEntity).toList())
                  .stream().map(this::toDomain).toList();
    }

    @Override
    public List<PlanningTask> findAllByCoupleId(UUID coupleId) {
        return jpa.findAllByCoupleIdOrderBySortOrderAsc(coupleId).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<PlanningTask> findById(UUID id) {
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

    @Override
    public long countByCoupleId(UUID coupleId) {
        return jpa.countByCoupleId(coupleId);
    }

    private PlanningTask toDomain(PlanningTaskEntity e) {
        return new PlanningTask(
                e.getId(), e.getCoupleId(), e.getTitle(), e.getCategory(),
                e.getDueMonthsBefore(), e.isCompleted(), e.getCompletedAt(),
                e.isSeeded(), e.getSortOrder(), e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private PlanningTaskEntity toEntity(PlanningTask t) {
        return PlanningTaskEntity.builder()
                .id(t.id())
                .coupleId(t.coupleId())
                .title(t.title())
                .category(t.category())
                .dueMonthsBefore(t.dueMonthsBefore())
                .isCompleted(t.isCompleted())
                .completedAt(t.completedAt())
                .isSeeded(t.isSeeded())
                .sortOrder(t.sortOrder())
                .createdAt(t.createdAt())
                .updatedAt(t.updatedAt())
                .build();
    }
}
