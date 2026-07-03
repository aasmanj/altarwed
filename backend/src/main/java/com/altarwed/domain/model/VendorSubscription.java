package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record VendorSubscription(
        UUID id,
        UUID vendorId,
        PlanTier planTier,
        SubscriptionStatus status,
        String stripeCustomerId,
        String stripeSubscriptionId,
        LocalDateTime currentPeriodStart,
        LocalDateTime currentPeriodEnd,
        LocalDateTime cancelledAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        // V84: timestamp of the last Stripe webhook event applied to this row (the event's own
        // `created`, not a subscription field). Null for rows never touched by a webhook (comped
        // or founding-vendor grants). Lets StripeService detect and drop an out-of-order,
        // already-superseded webhook delivery instead of applying it over newer state.
        LocalDateTime lastStripeEventAt
) {}
