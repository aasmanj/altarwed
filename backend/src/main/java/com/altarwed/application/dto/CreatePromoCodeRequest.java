package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.time.OffsetDateTime;

/**
 * Admin request to issue a new DB-backed vendor comp promo code. maxRedemptions and expiresAt are
 * optional: omit maxRedemptions for an uncapped code and expiresAt for one that never expires.
 * Boxed types per the DTO rule, so "not provided" is representable as null rather than a default.
 */
public record CreatePromoCodeRequest(
        @NotBlank(message = "Promo code is required") String code,
        @Positive(message = "maxRedemptions must be positive") Integer maxRedemptions,
        OffsetDateTime expiresAt
) {}
