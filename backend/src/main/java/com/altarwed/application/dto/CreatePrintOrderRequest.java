package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record CreatePrintOrderRequest(
        @NotNull String orderType,        // "SAVE_THE_DATE" or "INVITATION"
        @NotBlank String templateKey,
        @NotEmpty List<UUID> guestIds,
        // Return-address block printed on the postcard back
        @NotBlank String returnName,
        @NotBlank String returnAddressLine1,
        String returnAddressLine2,
        @NotBlank String returnCity,
        @NotBlank String returnState,
        @NotBlank String returnZip
) {}
