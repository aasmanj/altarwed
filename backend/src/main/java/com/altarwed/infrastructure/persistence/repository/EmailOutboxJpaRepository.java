package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.EmailOutboxEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface EmailOutboxJpaRepository extends JpaRepository<EmailOutboxEntity, UUID> {

    // Due, undelivered rows oldest first. Pageable caps the batch so one poll never
    // pulls an unbounded set into memory.
    List<EmailOutboxEntity> findByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
            String status, LocalDateTime now, Pageable pageable);

    // Each mark is its own committed unit of work (its own transaction) so one row's
    // outcome never rolls back another's within the same sender poll. Targeted UPDATEs
    // avoid a load-then-flush round trip on the hot drain path.
    @Modifying
    @Transactional
    @Query("update EmailOutboxEntity e set e.status = 'SENT', e.sentAt = :sentAt where e.id = :id")
    int markSent(@Param("id") UUID id, @Param("sentAt") LocalDateTime sentAt);

    @Modifying
    @Transactional
    @Query("update EmailOutboxEntity e set e.attempts = :attempts, e.nextAttemptAt = :nextAttemptAt, "
            + "e.lastError = :lastError where e.id = :id")
    int markForRetry(@Param("id") UUID id, @Param("attempts") int attempts,
                     @Param("nextAttemptAt") LocalDateTime nextAttemptAt,
                     @Param("lastError") String lastError);

    @Modifying
    @Transactional
    @Query("update EmailOutboxEntity e set e.status = 'FAILED', e.attempts = :attempts, "
            + "e.lastError = :lastError where e.id = :id")
    int markFailed(@Param("id") UUID id, @Param("attempts") int attempts,
                   @Param("lastError") String lastError);
}
