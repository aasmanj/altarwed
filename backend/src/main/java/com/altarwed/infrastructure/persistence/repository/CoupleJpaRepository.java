package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.CoupleEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CoupleJpaRepository extends JpaRepository<CoupleEntity, UUID> {

    Optional<CoupleEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    /**
     * Couples due for one touch of the win-back sequence (issue #551): they signed up inside the
     * touch's window, are still active, have no published wedding website, and have not already
     * been sent this touch.
     *
     * Every filter is pushed into SQL on purpose. The alternative (load the signup window, then
     * check publication and dedupe per couple in Java) is an N+1 that gets slower with exactly the
     * signup growth this feature exists to drive. The signup-window predicate seeks the filtered
     * index added in V108; both NOT EXISTS clauses seek an existing clustered key
     * (wedding_websites.couple_id, couple_winback_sends (couple_id, touch)).
     *
     * The soft-delete check matters: a couple who published and then deleted their site is not
     * activated any more, so they are a legitimate win-back target again.
     *
     * Ordered oldest-signup-first so that when a backlog exceeds the page size, the couples closest
     * to ageing out of the window are served first.
     */
    @Query("""
            SELECT c FROM CoupleEntity c
            WHERE c.isActive = true
              AND c.createdAt >= :signedUpFrom
              AND c.createdAt < :signedUpUntil
              AND (c.weddingDate IS NULL OR c.weddingDate >= :onOrAfterWeddingDate)
              AND NOT EXISTS (
                  SELECT w.id FROM WeddingWebsiteEntity w
                  WHERE w.coupleId = c.id AND w.isPublished = true AND w.isDeleted = false)
              AND NOT EXISTS (
                  SELECT s.id FROM CoupleWinbackSendEntity s
                  WHERE s.coupleId = c.id AND s.touch = :touch)
            ORDER BY c.createdAt ASC
            """)
    List<CoupleEntity> findWinbackCandidates(@Param("touch") String touch,
                                             @Param("signedUpFrom") LocalDateTime signedUpFrom,
                                             @Param("signedUpUntil") LocalDateTime signedUpUntil,
                                             @Param("onOrAfterWeddingDate") LocalDate onOrAfterWeddingDate,
                                             Pageable pageable);
}
