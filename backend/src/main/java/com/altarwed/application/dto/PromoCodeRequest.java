package com.altarwed.application.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Vendor-submitted comp promo code (e.g. on the "Your account is ready" step or the subscription
 * page). Validated server-side in VendorPromoService; a match grants a free, non-Stripe listing.
 */
public record PromoCodeRequest(
        @NotBlank(message = "Promo code is required") String code
) {}
