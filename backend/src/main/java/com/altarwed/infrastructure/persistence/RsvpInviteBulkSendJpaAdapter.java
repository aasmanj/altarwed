package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.RsvpInviteBulkSend;
import com.altarwed.domain.port.RsvpInviteBulkSendRepository;
import com.altarwed.infrastructure.persistence.entity.RsvpInviteBulkSendEntity;
import com.altarwed.infrastructure.persistence.repository.RsvpInviteBulkSendJpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Repository
public class RsvpInviteBulkSendJpaAdapter implements RsvpInviteBulkSendRepository {

    private final RsvpInviteBulkSendJpaRepository jpa;

    public RsvpInviteBulkSendJpaAdapter(RsvpInviteBulkSendJpaRepository jpa) {
        this.jpa = jpa;
    }

    // REQUIRES_NEW + saveAndFlush for the same two reasons documented at length in
    // SaveTheDateSendJpaAdapter.save: the claim must (1) flush now so a unique-key
    // collision surfaces HERE as DataIntegrityViolationException for the service to
    // turn into a replay, and (2) fail in its own transaction so the collision does
    // not doom the caller's ambient sendInvitesBulk transaction, which must stay
    // alive to read the winning receipt.
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public RsvpInviteBulkSend save(RsvpInviteBulkSend send) {
        return toDomain(jpa.saveAndFlush(toEntity(send)));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<RsvpInviteBulkSend> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey) {
        return jpa.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey).map(this::toDomain);
    }

    private RsvpInviteBulkSendEntity toEntity(RsvpInviteBulkSend s) {
        return RsvpInviteBulkSendEntity.builder()
                .id(s.id())
                .coupleId(s.coupleId())
                .idempotencyKey(s.idempotencyKey())
                .sentCount(s.sentCount())
                .skippedCount(s.skippedCount())
                .createdAt(s.createdAt())
                .build();
    }

    private RsvpInviteBulkSend toDomain(RsvpInviteBulkSendEntity e) {
        return new RsvpInviteBulkSend(
                e.getId(),
                e.getCoupleId(),
                e.getIdempotencyKey(),
                e.getSentCount(),
                e.getSkippedCount(),
                e.getCreatedAt()
        );
    }
}
