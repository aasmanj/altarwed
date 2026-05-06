package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.SeatingTableEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SeatingTableJpaRepository extends JpaRepository<SeatingTableEntity, UUID> {
    List<SeatingTableEntity> findAllByCoupleIdOrderBySortOrderAsc(UUID coupleId);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
}
