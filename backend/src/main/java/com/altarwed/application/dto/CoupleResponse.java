package com.altarwed.application.dto;

import com.altarwed.domain.model.Couple;

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
) {
    public static CoupleResponse from(Couple couple) {
        return new CoupleResponse(
                couple.id(),
                couple.partnerOneName(),
                couple.partnerTwoName(),
                couple.email(),
                couple.weddingDate(),
                couple.denominationId(),
                couple.isActive(),
                couple.createdAt()
        );
    }
}
