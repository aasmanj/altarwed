package com.altarwed.domain.model;

public enum PrintOrderStatus {
    // Legacy: pre-#59 orders that predate the payment gate. New orders never use this.
    DRAFT,
    // Issue #59: order created, Stripe Checkout Session created, awaiting the couple's payment.
    // Nothing has been sent to Lob and no charge has been captured yet.
    PENDING_PAYMENT,
    // Issue #53: payment confirmed via Stripe webhook; the Lob batch is running asynchronously,
    // persisting each recipient's outcome incrementally.
    PROCESSING,
    SUBMITTED,
    PARTIAL_FAILURE,
    FAILED,
    MAILED
}
