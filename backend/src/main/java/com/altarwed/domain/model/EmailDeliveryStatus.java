package com.altarwed.domain.model;

/**
 * Lifecycle status of a single outbound email, derived from Resend webhook events.
 * Ordered loosely from least to most informative; {@link #rank()} lets the webhook
 * processor ignore an out-of-order event that would downgrade a more terminal state
 * (e.g. a late "sent" arriving after "delivered").
 */
public enum EmailDeliveryStatus {
    // email.sent: Resend accepted the API request (not yet a delivery guarantee).
    SENT(0),
    // email.delivery_delayed: temporary trouble reaching the recipient's server.
    DELAYED(1),
    // email.delivered: recipient's mail server accepted the message.
    DELIVERED(2),
    // email.complained: recipient marked it as spam.
    COMPLAINED(3),
    // email.bounced: permanently (or transiently) rejected.
    BOUNCED(4);

    private final int rank;

    EmailDeliveryStatus(int rank) {
        this.rank = rank;
    }

    public int rank() {
        return rank;
    }
}
