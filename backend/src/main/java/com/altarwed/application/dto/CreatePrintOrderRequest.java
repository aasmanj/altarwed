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
        @NotBlank String returnZip,
        // Client-generated dedup token (UUID). Optional for backward compatibility,
        // but the web client always sends one. A repeat submit with the same key
        // returns the original order instead of mailing the batch again.
        String idempotencyKey,
        // Printed-card shape/size: LANDSCAPE_6X11 (default), PORTRAIT_6X9, or PORTRAIT_5X7.
        // Nullable for backward compatibility; a null (or unrecognized) value renders the
        // original 6x11 landscape. Validated by the DB CHECK constraint (V89) and defaulted in
        // the Lob adapter, so no @Pattern here keeps an old/newer client from being rejected.
        String cardSize
) {}
