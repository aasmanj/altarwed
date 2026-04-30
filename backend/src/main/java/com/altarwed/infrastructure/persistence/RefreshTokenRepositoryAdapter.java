package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.RefreshToken;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.infrastructure.persistence.entity.RefreshTokenEntity;
import com.altarwed.infrastructure.persistence.repository.RefreshTokenJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class RefreshTokenRepositoryAdapter implements RefreshTokenRepository {

    private final RefreshTokenJpaRepository jpaRepository;

    @Override
    public RefreshToken save(RefreshToken token) {
        return toDomain(jpaRepository.save(toEntity(token)));
    }

    @Override
    public Optional<RefreshToken> findByTokenHash(String tokenHash) {
        return jpaRepository.findByTokenHash(tokenHash).map(this::toDomain);
    }

    @Override
    public void deleteByTokenHash(String tokenHash) {
        jpaRepository.deleteByTokenHash(tokenHash);
    }

    @Override
    public void deleteAllByUserId(UUID userId) {
        jpaRepository.deleteAllByUserId(userId);
    }

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private RefreshToken toDomain(RefreshTokenEntity e) {
        return new RefreshToken(
                e.getId(),
                e.getTokenHash(),
                e.getUserId(),
                e.getUserRole(),
                e.getExpiresAt(),
                e.isRevoked(),
                e.getCreatedAt()
        );
    }

    private RefreshTokenEntity toEntity(RefreshToken r) {
        return RefreshTokenEntity.builder()
                .id(r.id())
                .tokenHash(r.tokenHash())
                .userId(r.userId())
                .userRole(r.userRole())
                .expiresAt(r.expiresAt())
                .revoked(r.revoked())
                .createdAt(r.createdAt())
                .build();
    }
}
