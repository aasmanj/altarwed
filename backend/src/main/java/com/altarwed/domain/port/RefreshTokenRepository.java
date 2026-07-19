package com.altarwed.domain.port;

import com.altarwed.domain.model.RefreshToken;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository {
    RefreshToken save(RefreshToken token);
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    void deleteByTokenHash(String tokenHash);
    void deleteAllByUserId(UUID userId);
    void deleteAllByFamilyId(UUID familyId);
    void deleteAllByUserIdAndExpiresAtBefore(UUID userId, LocalDateTime cutoff);
}
