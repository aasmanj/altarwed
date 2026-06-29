package com.altarwed.application.dto;

import java.time.OffsetDateTime;

/**
 * Admin view of a comp promo code with its redemption stats. maxRedemptions / expiresAt are null
 * when the code is uncapped / non-expiring.
 */
public record PromoCodeResponse(
        String code,
        Integer maxRedemptions,
        Integer redeemedCount,
        OffsetDateTime expiresAt
) {}
