package com.altarwed.application.dto;

import java.util.UUID;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        UUID coupleId,
        String email
) {
    public static AuthResponse of(String accessToken, String refreshToken, UUID coupleId, String email) {
        return new AuthResponse(accessToken, refreshToken, "Bearer", coupleId, email);
    }
}
