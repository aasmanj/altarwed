package com.altarwed.domain.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record Couple(
        UUID id,
        String partnerOneName,
        String partnerTwoName,
        String email,
        String passwordHash,
        LocalDate weddingDate,
        UUID denominationId,
        AcquisitionSource acquisition,
        boolean isActive,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public Couple withWeddingDate(LocalDate newDate) {
        return new Couple(id, partnerOneName, partnerTwoName, email, passwordHash,
                newDate, denominationId, acquisition, isActive, createdAt, LocalDateTime.now());
    }

    public Couple withDenomination(UUID newDenominationId) {
        return new Couple(id, partnerOneName, partnerTwoName, email, passwordHash,
                weddingDate, newDenominationId, acquisition, isActive, createdAt, LocalDateTime.now());
    }

    public Couple deactivated() {
        return new Couple(id, partnerOneName, partnerTwoName, email, passwordHash,
                weddingDate, denominationId, acquisition, false, createdAt, LocalDateTime.now());
    }

    public Couple withPasswordHash(String newPasswordHash) {
        return new Couple(id, partnerOneName, partnerTwoName, email, newPasswordHash,
                weddingDate, denominationId, acquisition, isActive, createdAt, LocalDateTime.now());
    }
}
