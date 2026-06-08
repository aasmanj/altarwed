package com.altarwed.domain.port;

import java.time.Instant;
import java.util.UUID;

public interface StripePort {

    String createCheckoutSession(UUID vendorId, String vendorEmail, String priceId,
                                 String successUrl, String cancelUrl);

    String createPortalSession(String stripeCustomerId, String returnUrl);

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
            Instant cancelledAt
    ) {}

    class StripeCallException extends RuntimeException {
        public StripeCallException(String message) { super(message); }
        public StripeCallException(String message, Throwable cause) { super(message, cause); }
    }
}
