package com.altarwed.application.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record CoupleResponse(
        UUID id,
        String partnerOneName,
        String partnerTwoName,
        String email,
        LocalDate weddingDate,
        UUID denominationId,
        boolean isActive,
        LocalDateTime createdAt
) {}
