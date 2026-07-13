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
     * later, view time-series). True while the subscription is ACTIVE or TRIALING. This covers a
     * paid Pro subscription (ACTIVE with a Stripe subscription id), a comped listing (ACTIVE with
     * no Stripe id, granted by promo, since a comp is modelled as ACTIVE), and a vendor in a Stripe
     * trial (TRIALING), who is verified and publicly listed and should see the analytics that drive
     * the trial-to-paid conversion. TRIALING is kept consistent with StripeService, which treats
     * ACTIVE and TRIALING as entitled-equivalent. It excludes PENDING, PAST_DUE, and CANCELLED, so
     * a lapsed or unpaid vendor loses the entitlement the moment the webhook flips the status. Pure
     * domain logic with no Spring/JPA dependency, so both the service and its unit tests can call it.
     */
    public boolean hasProAnalyticsAccess() {
        return status == SubscriptionStatus.ACTIVE || status == SubscriptionStatus.TRIALING;
    }
}
