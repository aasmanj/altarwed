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

    // Derived delete; runs inside the caller's transaction (the resubscribe service
    // method is @Transactional). Returns the number of rows removed so the caller can
    // tell "resubscribed" from "was not suppressed".
    long deleteByEmailHash(String emailHash);
}
