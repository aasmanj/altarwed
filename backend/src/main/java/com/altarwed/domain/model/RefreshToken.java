package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record RefreshToken(
        UUID id,
        String tokenHash,
        UUID userId,
        String userRole,
        UUID familyId,
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

    /**
     * The rotation chain this token belongs to. Rows created before family
     * tracking existed have a NULL family_id; they become the root of their own
     * family, so the chain id is stable from the first post-migration rotation.
     */
    public UUID familyIdOrSelf() {
        return familyId != null ? familyId : id;
    }

    /**
     * Copy of this token marked as superseded by a rotation. The row is kept
     * (not deleted) so a later replay of this token is distinguishable from a
     * token we never issued; that replay is the theft tripwire.
     */
    public RefreshToken superseded() {
        return new RefreshToken(id, tokenHash, userId, userRole, familyIdOrSelf(), expiresAt, true, createdAt);
    }
}
