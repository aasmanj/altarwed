package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.email.CoupleWinbackCandidate;
import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.port.CoupleWinbackRepository;
import com.altarwed.infrastructure.persistence.entity.CoupleEntity;
import com.altarwed.infrastructure.persistence.entity.CoupleWinbackSendEntity;
import com.altarwed.infrastructure.persistence.repository.CoupleJpaRepository;
import com.altarwed.infrastructure.persistence.repository.CoupleWinbackSendJpaRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * JPA adapter implementing {@link CoupleWinbackRepository} (issue #551). Maps the couples row onto
 * the narrow {@link CoupleWinbackCandidate} projection the scheduler needs and writes the
 * send-once ledger row.
 *
 * recordSent delegates to the Spring Data save with the default REQUIRED propagation, so it joins
 * the caller's transaction: {@code CoupleWinbackSender} enqueues the outbox row and records the
 * marker in one unit of work, and the unique constraint on (couple_id, touch) rolls both back if a
 * concurrent run already sent this touch.
 */
@Component
public class CoupleWinbackRepositoryAdapter implements CoupleWinbackRepository {

    private final CoupleJpaRepository coupleJpa;
    private final CoupleWinbackSendJpaRepository sendJpa;

    public CoupleWinbackRepositoryAdapter(CoupleJpaRepository coupleJpa,
                                          CoupleWinbackSendJpaRepository sendJpa) {
        this.coupleJpa = coupleJpa;
        this.sendJpa = sendJpa;
    }

    @Override
    public List<CoupleWinbackCandidate> findWinbackCandidates(CoupleWinbackTouch touch,
                                                              LocalDateTime signedUpFrom,
                                                              LocalDateTime signedUpUntil,
                                                              LocalDate onOrAfterWeddingDate,
                                                              int limit) {
        return coupleJpa.findWinbackCandidates(touch.name(), signedUpFrom, signedUpUntil,
                        onOrAfterWeddingDate, PageRequest.of(0, limit))
                .stream()
                .map(CoupleWinbackRepositoryAdapter::toCandidate)
                .toList();
    }

    @Override
    public void recordSent(UUID coupleId, CoupleWinbackTouch touch, LocalDateTime sentAt) {
        sendJpa.save(CoupleWinbackSendEntity.builder()
                .id(UUID.randomUUID())
                .coupleId(coupleId)
                .touch(touch.name())
                .sentAt(sentAt)
                .build());
    }

    private static CoupleWinbackCandidate toCandidate(CoupleEntity e) {
        return new CoupleWinbackCandidate(
                e.getId(), e.getEmail(), e.getPartnerOneName(), e.getPartnerTwoName());
    }
}
