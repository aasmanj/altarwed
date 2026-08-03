package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.port.CoupleWinbackTouchRepository;
import com.altarwed.infrastructure.persistence.entity.CoupleWinbackTouchEntity;
import com.altarwed.infrastructure.persistence.repository.CoupleWinbackTouchJpaRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

/**
 * JPA adapter implementing the {@link CoupleWinbackTouchRepository} port (issue #551). Maps
 * between the pure-domain {@link CoupleWinbackTouch} enum and the persisted string column.
 *
 * recordSent delegates to the Spring Data save (propagation REQUIRED), so when
 * CoupleWinbackSender calls it inside its own @Transactional method the ledger row and the
 * outbox enqueue commit or roll back atomically. A duplicate (couple, touch) insert surfaces
 * as a DataIntegrityViolationException from the unique constraint, which rolls the whole
 * per-couple unit back rather than committing a second email.
 */
@Component
public class CoupleWinbackTouchRepositoryAdapter implements CoupleWinbackTouchRepository {

    private final CoupleWinbackTouchJpaRepository jpa;

    public CoupleWinbackTouchRepositoryAdapter(CoupleWinbackTouchJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public Set<CoupleWinbackTouch> findSentTouches(UUID coupleId) {
        Set<CoupleWinbackTouch> touches = EnumSet.noneOf(CoupleWinbackTouch.class);
        for (CoupleWinbackTouchEntity e : jpa.findByCoupleId(coupleId)) {
            touches.add(CoupleWinbackTouch.valueOf(e.getTouch()));
        }
        return touches;
    }

    @Override
    public void recordSent(UUID coupleId, CoupleWinbackTouch touch, LocalDateTime sentAt) {
        jpa.save(CoupleWinbackTouchEntity.builder()
                .id(UUID.randomUUID())
                .coupleId(coupleId)
                .touch(touch.name())
                .sentAt(sentAt)
                .build());
    }
}
