package com.altarwed.domain.port;

/**
 * Payment provider boundary (Stripe is the first implementation).
 *
 * Keeps Stripe out of the domain/application layers: services depend on this
 * interface, the StripePaymentAdapter in infrastructure/ does the real HTTP. The
 * IDs below are opaque external references (Stripe customer/subscription ids); the
 * domain never interprets them, it just stores them on VendorSubscription.
 *
 * Flow (vendor subscription, hosted Checkout to stay in PCI SAQ-A scope):
 *   1. Vendor picks a plan -> createSubscriptionCheckout() -> redirect to url.
 *   2. Stripe collects payment, then fires webhooks.
 *   3. Webhook handler verifies the signature, parses the event, and updates the
 *      VendorSubscription. ONLY the webhook is trusted to flip status, never the
 *      client. Dedupe on event id (reuse the idempotency pattern from print orders).
 *   4. Vendor manages/cancels via createBillingPortalUrl().
 */
public interface PaymentPort {

    /** Creates a hosted Checkout Session for a recurring plan; returns the redirect URL. */
    CheckoutSession createSubscriptionCheckout(CheckoutRequest request);

    /** Creates a Stripe Billing Portal session so the vendor can update/cancel; returns the URL. */
    String createBillingPortalUrl(String stripeCustomerId, String returnUrl);

    /** True if the webhook payload's signature matches the configured signing secret. */
    boolean verifyWebhookSignature(String payload, String signatureHeader);

    /** Parses a (signature-verified) webhook payload into a provider-neutral event. */
    WebhookEvent parseWebhookEvent(String payload);

    /** What we need to start a subscription checkout for one vendor + plan. */
    record CheckoutRequest(
            String priceId,        // Stripe Price id for the chosen plan (BASIC/FEATURED/PREMIUM)
            String vendorId,       // our vendor UUID, round-tripped via client_reference_id/metadata
            String customerEmail,
            String successUrl,
            String cancelUrl
    ) {}

    record CheckoutSession(String sessionId, String url) {}

    /**
     * The subset of a Stripe event the subscription state machine cares about.
     * type is e.g. "checkout.session.completed", "customer.subscription.updated",
     * "customer.subscription.deleted", "invoice.payment_failed".
     */
    record WebhookEvent(
            String id,                    // Stripe event id, for idempotent processing
            String type,
            String vendorId,              // pulled from metadata/client_reference_id when present
            String stripeCustomerId,
            String stripeSubscriptionId,
            String subscriptionStatus     // active / past_due / canceled / ...
    ) {}
}
