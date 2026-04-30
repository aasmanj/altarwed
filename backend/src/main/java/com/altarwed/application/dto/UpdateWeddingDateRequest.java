package com.altarwed.application.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record UpdateWeddingDateRequest(
        @NotNull(message = "Wedding date is required")
        LocalDate weddingDate
) {}
