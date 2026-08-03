package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.CoupleWinbackSendEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * Spring Data repository for the win-back send-once ledger (issue #551). Reads happen through the
 * NOT EXISTS subquery in {@link CoupleJpaRepository#findWinbackCandidates}, so the only operation
 * needed here is the insert; the unique constraint on (couple_id, touch) does the deduplication.
 */
public interface CoupleWinbackSendJpaRepository extends JpaRepository<CoupleWinbackSendEntity, UUID> {
}
