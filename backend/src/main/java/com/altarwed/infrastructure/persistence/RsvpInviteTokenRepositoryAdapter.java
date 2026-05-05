package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.RsvpInviteToken;
import com.altarwed.domain.port.RsvpInviteTokenRepository;
import com.altarwed.infrastructure.persistence.entity.RsvpInviteTokenEntity;
import com.altarwed.infrastructure.persistence.repository.RsvpInviteTokenJpaRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Component
public class RsvpInviteTokenRepositoryAdapter implements RsvpInviteTokenRepository {

    private final RsvpInviteTokenJpaRepository jpa;

    public RsvpInviteTokenRepositoryAdapter(RsvpInviteTokenJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public RsvpInviteToken save(RsvpInviteToken token) {
        return toDomain(jpa.save(toEntity(token)));
    }

    @Override
    public Optional<RsvpInviteToken> findByTokenHash(String tokenHash) {
        return jpa.findByTokenHash(tokenHash).map(this::toDomain);
    }

    @Override
    public void deleteAllByGuestId(UUID guestId) {
        jpa.deleteAllByGuestId(guestId);
    }

    @Override
    public void markUsed(String tokenHash) {
        jpa.markUsed(tokenHash, LocalDateTime.now());
    }

    private RsvpInviteToken toDomain(RsvpInviteTokenEntity e) {
        return new RsvpInviteToken(e.getId(), e.getTokenHash(), e.getGuestId(),
                e.getExpiresAt(), e.isUsed(), e.getUsedAt());
    }

    private RsvpInviteTokenEntity toEntity(RsvpInviteToken t) {
        return RsvpInviteTokenEntity.builder()
                .id(t.id())
                .tokenHash(t.tokenHash())
                .guestId(t.guestId())
                .expiresAt(t.expiresAt())
                .used(t.used())
                .usedAt(t.usedAt())
                .build();
    }
}
