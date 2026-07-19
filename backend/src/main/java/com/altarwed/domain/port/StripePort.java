package com.altarwed.domain.port;

import java.time.Instant;
import java.util.UUID;

public interface StripePort {

    String createCheckoutSession(UUID vendorId, String vendorEmail, String priceId,
                                 String successUrl, String cancelUrl);

    String createPortalSession(String stripeCustomerId, String returnUrl);

    /**
     * Issue #59: a one-off Mode.PAYMENT Checkout Session (not a subscription) for a couple's
     * print order. Couples have no Stripe customer today (unlike vendors), so this takes an
     * email rather than a stored customer id, matching Stripe's guest-checkout support.
     * printOrderId rides in session metadata (mirrors createCheckoutSession's vendorId metadata
     * pattern) so the webhook can correlate the event back to the order. Returns both the real
     * session id and the hosted Checkout URL -- callers must use the returned id directly rather
     * than parsing it back out of the URL.
     */
    CheckoutSession createOneTimeCheckoutSession(UUID printOrderId, String coupleEmail, long amountCents,
                                                 String description, String successUrl, String cancelUrl);

    record CheckoutSession(String sessionId, String url) {}

    /**
     * Issue #59: partial or full refund of a captured payment, keyed by Stripe's payment intent
     * id. idempotencyKey must be deterministic per logical refund (callers use the print order
     * id) so that if submitBatchAsync is ever re-triggered for the same order (a retry, or a
     * duplicate async invocation), Stripe returns the ORIGINAL refund instead of creating a
     * second one -- refunding the couple twice is real money lost.
     */
    void refundPayment(String paymentIntentId, long amountCents, String idempotencyKey);

    /**
     * Issue #209: read-only lookup of a Checkout Session's current payment state, used by the
     * reconciliation job to converge print orders stuck in PENDING_PAYMENT after a lost
     * checkout.session.completed webhook. Webhooks are at-most-once from our perspective (Stripe
     * retries for a while, but delivery is never guaranteed), so the source of truth for "did the
     * couple actually pay" is Stripe's session object itself, not our webhook history. This call
     * mutates nothing on Stripe's side.
     */
    CheckoutSessionStatus retrieveCheckoutSessionStatus(String sessionId);

    /**
     * Issue #209: only the three fields the reconciler's decision needs (no amounts, no customer
     * details -- they must never reach logs or callers that do not need them).
     * sessionStatus is Stripe's session lifecycle: open | complete | expired.
     * paymentStatus is the money truth: paid | unpaid | no_payment_required.
     * paymentIntentId is only populated once the couple actually paid.
     */
    record CheckoutSessionStatus(String sessionStatus, String paymentStatus, String paymentIntentId) {}

    StripeEventData constructEvent(byte[] payload, String sigHeader);

    record StripeEventData(
            String eventType,
            String stripeSubscriptionId,
            String stripeCustomerId,
            String vendorId,
            String priceId,
            String stripeStatus,
            Instant currentPeriodStart,
            Instant currentPeriodEnd,
            Instant cancelledAt,
            // The Stripe event's own `created` timestamp (not the subscription's). Used to detect
            // and drop stale, out-of-order webhook deliveries -- see StripeService's staleness guard.
            Instant eventCreatedAt,
            // Issue #59: populated only for checkout.session.completed/expired (one-time print
            // order payments), null for subscription/invoice events.
            String stripeCheckoutSessionId,
            String stripePaymentIntentId,
            String printOrderId,
            Long amountTotalCents
    ) {}

    class StripeCallException extends RuntimeException {
        public StripeCallException(String message) { super(message); }
        public StripeCallException(String message, Throwable cause) { super(message, cause); }
    }
}
