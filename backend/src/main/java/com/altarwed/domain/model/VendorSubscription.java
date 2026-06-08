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
        LocalDateTime updatedAt
) {}
