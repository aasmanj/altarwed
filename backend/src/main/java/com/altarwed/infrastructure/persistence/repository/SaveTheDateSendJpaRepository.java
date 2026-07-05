package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.SaveTheDateSendEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SaveTheDateSendJpaRepository extends JpaRepository<SaveTheDateSendEntity, UUID> {
    Optional<SaveTheDateSendEntity> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey);
}
