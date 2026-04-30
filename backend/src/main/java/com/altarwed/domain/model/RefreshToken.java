package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record RefreshToken(
        UUID id,
        String tokenHash,
        UUID userId,
        String userRole,
        LocalDateTime expiresAt,
        boolean revoked,
        LocalDateTime createdAt
) {
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isValid() {
        return !revoked && !isExpired();
    }
}
