package com.altarwed.domain.port;

import com.altarwed.domain.model.PasswordResetToken;

import java.util.Optional;

public interface PasswordResetTokenRepository {
    PasswordResetToken save(PasswordResetToken token);
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);
    void deleteAllByEmail(String email);
    void markUsed(String tokenHash);
}
