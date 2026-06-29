package com.altarwed.domain.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A DB-backed vendor comp promo code. A valid redemption grants a free FEATURED listing without
 * Stripe (see VendorPromoService). maxRedemptions and expiresAt are both nullable: null means
 * "no cap" and "never expires" respectively. redeemedCount is incremented on each successful
 * redemption so the cap check is a single read instead of a count over the audit table.
 */
public record VendorPromoCode(
        UUID id,
        String code,
        Integer maxRedemptions,
        OffsetDateTime expiresAt,
        Integer redeemedCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
