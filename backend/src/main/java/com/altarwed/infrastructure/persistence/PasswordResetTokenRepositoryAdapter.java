package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.PasswordResetToken;
import com.altarwed.domain.port.PasswordResetTokenRepository;
import com.altarwed.infrastructure.persistence.entity.PasswordResetTokenEntity;
import com.altarwed.infrastructure.persistence.repository.PasswordResetTokenJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class PasswordResetTokenRepositoryAdapter implements PasswordResetTokenRepository {

    private final PasswordResetTokenJpaRepository jpaRepository;

    @Override
    public PasswordResetToken save(PasswordResetToken token) {
        return toDomain(jpaRepository.save(toEntity(token)));
    }

    @Override
    public Optional<PasswordResetToken> findByTokenHash(String tokenHash) {
        return jpaRepository.findByTokenHash(tokenHash).map(this::toDomain);
    }

    @Override
    public void deleteAllByEmail(String email) {
        jpaRepository.deleteAllByEmail(email);
    }

    @Override
    public void markUsed(String tokenHash) {
        jpaRepository.markUsedByTokenHash(tokenHash);
    }

    private PasswordResetToken toDomain(PasswordResetTokenEntity e) {
        return new PasswordResetToken(
                e.getId(),
                e.getTokenHash(),
                e.getEmail(),
                e.getExpiresAt(),
                e.isUsed(),
                e.getCreatedAt()
        );
    }

    private PasswordResetTokenEntity toEntity(PasswordResetToken t) {
        return PasswordResetTokenEntity.builder()
                .id(t.id())
                .tokenHash(t.tokenHash())
                .email(t.email())
                .expiresAt(t.expiresAt())
                .used(t.used())
                .createdAt(t.createdAt())
                .build();
    }
}
