package com.altarwed.domain.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Append-only audit record of a single comp promo code redemption: which code (codeId) was
 * redeemed by which vendor (vendorId) and when. Written alongside the redeemedCount increment on
 * VendorPromoCode so we can always reconstruct who was comped, even after the cap is reached.
 */
public record VendorPromoRedemption(
        UUID id,
        UUID codeId,
        UUID vendorId,
        OffsetDateTime redeemedAt
) {}
