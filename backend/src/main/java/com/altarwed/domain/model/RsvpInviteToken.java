package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record RsvpInviteToken(
        UUID id,
        String tokenHash,
        UUID guestId,
        LocalDateTime expiresAt,
        boolean used,
        LocalDateTime usedAt
) {
    public boolean isValid() {
        return !used && expiresAt.isAfter(LocalDateTime.now());
    }
}
