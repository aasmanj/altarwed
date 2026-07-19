package com.altarwed.application.dto;

import java.time.LocalDateTime;

public record SubscriptionResponse(
        String planTier,
        String status,
        LocalDateTime currentPeriodEnd,
        String proMonthlyPriceId,
        String proAnnualPriceId,
        // Issue #370 pricing ladder: Premium tier Stripe price ids. Blank/absent when Jordan has
        // not yet created the Premium prices in Stripe, in which case the UI simply does not
        // render the Premium tier (same graceful-absence pattern as a blank Pro id rendering the
        // billing-unavailable state).
        String premiumMonthlyPriceId,
        String premiumAnnualPriceId,
        // How many portfolio photos the vendor's effective tier allows (10 for Basic/Pro, 25 for
        // an active Premium). Boxed Integer per DTO rules. Served here so the listing page's cap
        // copy and upload gate follow the backend's enforcement instead of hardcoding 10.
        Integer portfolioPhotoCap,
        // True when the listing is comped (granted via promo, no Stripe). Lets the UI show "Comped"
        // and hide billing management (a comped vendor has no Stripe customer to manage).
        Boolean comped
) {}
