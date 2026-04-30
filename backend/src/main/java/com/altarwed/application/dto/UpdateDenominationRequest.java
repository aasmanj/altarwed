package com.altarwed.application.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record UpdateDenominationRequest(
        @NotNull(message = "Denomination ID is required")
        UUID denominationId
) {}
