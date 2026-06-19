package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.EmailSubscriptionEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EmailSubscriptionEventJpaRepository extends JpaRepository<EmailSubscriptionEventEntity, UUID> {

    // The canonical audit query: every event for one address, oldest first.
    // Backs an on-demand CAN-SPAM record for a given email hash.
    List<EmailSubscriptionEventEntity> findByEmailHashOrderByCreatedAtAsc(String emailHash);
}
