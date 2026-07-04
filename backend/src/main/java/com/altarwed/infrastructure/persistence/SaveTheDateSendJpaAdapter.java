package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.SaveTheDateSend;
import com.altarwed.domain.port.SaveTheDateSendRepository;
import com.altarwed.infrastructure.persistence.entity.SaveTheDateSendEntity;
import com.altarwed.infrastructure.persistence.repository.SaveTheDateSendJpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Repository
public class SaveTheDateSendJpaAdapter implements SaveTheDateSendRepository {

    private final SaveTheDateSendJpaRepository jpa;

    public SaveTheDateSendJpaAdapter(SaveTheDateSendJpaRepository jpa) {
        this.jpa = jpa;
    }

    // REQUIRES_NEW + saveAndFlush: the receipt is claimed in its OWN short transaction, not the
    // caller's ambient sendSaveDates transaction. This is the specific mechanism that differs from
    // PrintOrderService's idempotency: createOrder is deliberately NON-transactional, so its claim
    // already runs alone; sendSaveDates is @Transactional (it must be, for the guest stamp), so the
    // claim has to be forced out of that ambient transaction here. Two reasons, both required:
    //  1. saveAndFlush forces the INSERT to execute now, so a unique-key collision surfaces as a
    //     DataIntegrityViolationException at THIS call, which the service catches and replays.
    //     Deferred to the caller's commit it would instead bubble up as a raw 500.
    //  2. REQUIRES_NEW isolates that collision: the failed insert rolls back only this inner
    //     transaction, leaving the caller's transaction alive to read the winning receipt and
    //     return the replay. A collision inside the ambient transaction would doom it entirely.
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SaveTheDateSend save(SaveTheDateSend send) {
        return toDomain(jpa.saveAndFlush(toEntity(send)));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SaveTheDateSend> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey) {
        return jpa.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey).map(this::toDomain);
    }

    private SaveTheDateSendEntity toEntity(SaveTheDateSend s) {
        return SaveTheDateSendEntity.builder()
                .id(s.id())
                .coupleId(s.coupleId())
                .idempotencyKey(s.idempotencyKey())
                .queuedCount(s.queuedCount())
                .invalidCount(s.invalidCount())
                .suppressedCount(s.suppressedCount())
                .createdAt(s.createdAt())
                .build();
    }

    private SaveTheDateSend toDomain(SaveTheDateSendEntity e) {
        return new SaveTheDateSend(
                e.getId(),
                e.getCoupleId(),
                e.getIdempotencyKey(),
                e.getQueuedCount(),
                e.getInvalidCount(),
                e.getSuppressedCount(),
                e.getCreatedAt()
        );
    }
}
