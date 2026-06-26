package com.altarwed.application.dto;

import java.time.LocalDateTime;

public record SubscriptionResponse(
        String planTier,
        String status,
        LocalDateTime currentPeriodEnd,
        String proMonthlyPriceId,
        String proAnnualPriceId,
        // True when the listing is comped (granted via promo, no Stripe). Lets the UI show "Comped"
        // and hide billing management (a comped vendor has no Stripe customer to manage).
        Boolean comped
) {}
