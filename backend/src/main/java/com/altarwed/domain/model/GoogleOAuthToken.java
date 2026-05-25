package com.altarwed.domain.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Represents a stored Google OAuth token pair for a couple.
 * Zero Spring/JPA imports -- pure domain record.
 */
public record GoogleOAuthToken(
        UUID id,
        UUID coupleId,
        String accessToken,
        String refreshToken,
        String tokenType,
        OffsetDateTime expiresAt,
        String googleEmail,
        String scope,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
