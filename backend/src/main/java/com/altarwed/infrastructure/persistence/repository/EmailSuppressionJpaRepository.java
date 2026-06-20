package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.EmailSuppressionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmailSuppressionJpaRepository extends JpaRepository<EmailSuppressionEntity, UUID> {

    boolean existsByEmailHash(String emailHash);

    Optional<EmailSuppressionEntity> findByEmailHash(String emailHash);

    List<EmailSuppressionEntity> findByEmailHashIn(Collection<String> emailHashes);

    // Derived delete scoped to a source; runs inside the caller's transaction. Used to
    // clear a LEGACY global USER_REQUEST opt-out when the recipient resubscribes by
    // RSVPing (those predate the per-couple model). Never deletes a COMPLAINT or BOUNCE
    // row, so a global deliverability suppression can't be cleared by a guest action.
    long deleteByEmailHashAndSource(String emailHash, String source);
}
