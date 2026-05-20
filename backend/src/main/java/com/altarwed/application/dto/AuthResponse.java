package com.altarwed.application.dto;

import java.time.LocalDate;
import java.util.UUID;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        UUID userId,
        String email,
        String partnerOneName,
        String partnerTwoName,
        LocalDate weddingDate
) {
    public static AuthResponse of(String accessToken, String refreshToken, UUID userId, String email,
                                   String partnerOneName, String partnerTwoName, LocalDate weddingDate) {
        return new AuthResponse(accessToken, refreshToken, "Bearer", userId, email,
                partnerOneName, partnerTwoName, weddingDate);
    }
}
