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
) {
    /**
     * Whether this subscription entitles the vendor to Pro-only analytics (inquiry analytics and,
     * later, view time-series). True only while the subscription is ACTIVE. This deliberately
     * covers both a paid Pro subscription (ACTIVE with a Stripe subscription id) and a comped
     * listing (ACTIVE with no Stripe id, granted by promo), because a comp is modelled as an
     * ACTIVE subscription. It excludes PENDING, PAST_DUE, CANCELLED, and TRIALING, so a lapsed or
     * unpaid vendor loses the entitlement the moment the webhook flips the status. Pure domain
     * logic with no Spring/JPA dependency, so both the service and its unit tests can call it.
     */
    public boolean hasProAnalyticsAccess() {
        return status == SubscriptionStatus.ACTIVE;
    }
}
