package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record PasswordResetToken(
        UUID id,
        String tokenHash,
        String email,
        LocalDateTime expiresAt,
        boolean used,
        LocalDateTime createdAt
) {
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isValid() {
        return !used && !isExpired();
    }
}
