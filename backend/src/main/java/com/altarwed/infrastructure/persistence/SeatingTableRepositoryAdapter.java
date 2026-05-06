package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.SeatingTable;
import com.altarwed.domain.port.SeatingTableRepository;
import com.altarwed.infrastructure.persistence.entity.SeatingTableEntity;
import com.altarwed.infrastructure.persistence.repository.SeatingTableJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SeatingTableRepositoryAdapter implements SeatingTableRepository {

    private final SeatingTableJpaRepository jpa;

    @Override
    public SeatingTable save(SeatingTable table) {
        return toDomain(jpa.save(toEntity(table)));
    }

    @Override
    public Optional<SeatingTable> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public List<SeatingTable> findAllByCoupleId(UUID coupleId) {
        return jpa.findAllByCoupleIdOrderBySortOrderAsc(coupleId).stream().map(this::toDomain).toList();
    }

    @Override
    public void deleteById(UUID id) {
        jpa.deleteById(id);
    }

    @Override
    public boolean existsByIdAndCoupleId(UUID id, UUID coupleId) {
        return jpa.existsByIdAndCoupleId(id, coupleId);
    }

    private SeatingTable toDomain(SeatingTableEntity e) {
        return new SeatingTable(e.getId(), e.getCoupleId(), e.getName(),
                e.getCapacity(), e.getSortOrder(), e.getCreatedAt(), e.getUpdatedAt());
    }

    private SeatingTableEntity toEntity(SeatingTable t) {
        return SeatingTableEntity.builder()
                .id(t.id())
                .coupleId(t.coupleId())
                .name(t.name())
                .capacity(t.capacity())
                .sortOrder(t.sortOrder())
                .createdAt(t.createdAt())
                .updatedAt(t.updatedAt())
                .build();
    }
}
