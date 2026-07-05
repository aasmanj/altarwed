package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.RsvpInviteBulkSendEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RsvpInviteBulkSendJpaRepository extends JpaRepository<RsvpInviteBulkSendEntity, UUID> {
    Optional<RsvpInviteBulkSendEntity> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey);
}
