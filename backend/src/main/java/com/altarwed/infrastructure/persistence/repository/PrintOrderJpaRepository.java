package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.PrintOrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrintOrderJpaRepository extends JpaRepository<PrintOrderEntity, UUID> {
    List<PrintOrderEntity> findAllByCoupleIdOrderByCreatedAtDesc(UUID coupleId);
    Optional<PrintOrderEntity> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey);
}
