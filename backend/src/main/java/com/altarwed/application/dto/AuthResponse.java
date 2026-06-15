package com.altarwed.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDate;
import java.util.UUID;

public record AuthResponse(
        String accessToken,
        @JsonIgnore String refreshToken,   // extracted by controllers to set as HttpOnly cookie; never sent in JSON
        String tokenType,
        UUID userId,
        String email,
        String role,
        String partnerOneName,
        String partnerTwoName,
        LocalDate weddingDate,
        Boolean marketingConsent
) {
    public static AuthResponse of(String accessToken, String refreshToken, UUID userId, String email,
                                   String role,
                                   String partnerOneName, String partnerTwoName, LocalDate weddingDate,
                                   boolean marketingConsent) {
        return new AuthResponse(accessToken, refreshToken, "Bearer", userId, email,
                role, partnerOneName, partnerTwoName, weddingDate, marketingConsent);
    }
}
