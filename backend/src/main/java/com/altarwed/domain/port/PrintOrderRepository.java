package com.altarwed.domain.port;

import com.altarwed.domain.model.PrintOrder;
import com.altarwed.domain.model.PrintOrderRecipient;
import com.altarwed.domain.model.PrintOrderStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrintOrderRepository {
    PrintOrder save(PrintOrder order);
    Optional<PrintOrder> findById(UUID id);
    List<PrintOrder> findAllByCoupleId(UUID coupleId);
    Optional<PrintOrder> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey);
    void deleteAllByCoupleId(UUID coupleId);

    /**
     * Issue #53: persists one recipient's outcome immediately, independent of the parent
     * order's whole-aggregate {@link #save}. Must NOT go through the aggregate's
     * orphanRemoval-cascaded collection (a partial recipient list passed to {@link #save}
     * would delete every recipient not in that list) -- this is a direct insert.
     */
    void appendRecipient(UUID orderId, PrintOrderRecipient recipient);

    /**
     * Issue #53/#59: transitions one recipient row (inserted as PENDING at order-creation time,
     * see {@link #appendRecipient}) to its final outcome once the async Lob batch processes it.
     * Same rationale as {@link #appendRecipient}: a direct, targeted update, not a whole-aggregate
     * {@link #save}.
     */
    void updateRecipientOutcome(UUID recipientId, String lobPostcardId, String deliveryStatus, String errorMessage);

    /**
     * Issue #59: attaches the Stripe Checkout Session id once it's created. Two-step because the
     * session's metadata needs the order's generated id, which only exists after the initial
     * insert.
     */
    void attachCheckoutSession(UUID orderId, String stripeCheckoutSessionId);

    /**
     * Issue #59: flips the order to PROCESSING once the Stripe webhook confirms payment. A
     * compare-and-swap (only transitions rows currently PENDING_PAYMENT), not an unconditional
     * write: Stripe redelivers webhooks at-least-once, and two concurrent deliveries for the same
     * order must not both win and both trigger the mail batch. Returns true iff THIS call won the
     * transition -- callers must only trigger the async batch when this returns true. Does not
     * touch amountChargedCents: that was already validated and persisted at order-creation time.
     */
    boolean markPaymentConfirmed(UUID orderId, String stripePaymentIntentId);

    /**
     * Issue #59: flips the order to FAILED when payment is declined or the Checkout Session
     * expires. Same compare-and-swap reasoning as {@link #markPaymentConfirmed}.
     */
    boolean markPaymentFailed(UUID orderId, String errorMessage);

    /**
     * Issue #53: finalizes a PROCESSING order once the async Lob batch completes, independent
     * of the whole-aggregate {@link #save} (recipients were already persisted incrementally via
     * {@link #appendRecipient}, so this must not touch that collection).
     */
    void finalizeOrder(UUID orderId, PrintOrderStatus status, String errorMessage,
                        LocalDateTime submittedAt, Integer costCents);

    /** Issue #59: records a partial refund after some recipients failed post-charge. */
    void recordRefund(UUID orderId, Integer amountRefundedCents);

    /**
     * Issue #52: looks up a recipient by Lob's postcard id for webhook correlation, returning
     * just the fields the idempotency decision needs (not the full {@link PrintOrderRecipient}
     * aggregate), so the Lob webhook consumer never round-trips through the couple-facing
     * PrintOrderService (out of scope for issue #52 to touch). Empty when the id is unknown to
     * us, which the caller treats as a no-op, not an error (Lob may deliver events for postcards
     * outside our own account, or for a recipient row that predates this feature).
     */
    Optional<RecipientLobStatus> findRecipientLobStatus(String lobPostcardId);

    /**
     * Issue #52: unconditionally applies one Lob delivery-lifecycle webhook event. The caller
     * (LobWebhookService) has already decided this event should win, via the same rank +
     * timestamp comparison EmailDeliveryService uses for Resend webhooks (see
     * LobDeliveryStatus#rank); this is just the write. trackingNumber/expectedDeliveryDate are
     * only overwritten when the incoming value is non-null, so an event that doesn't carry them
     * (e.g. an early "in_transit" before USPS assigns a tracking number) never blanks out a value
     * a later/earlier event already established.
     */
    void applyLobDeliveryEvent(UUID recipientId, String deliveryStatus, LocalDateTime eventAt,
                               String trackingNumber, LocalDate expectedDeliveryDate);

    /** Issue #52: the subset of a recipient row the webhook idempotency decision needs. */
    record RecipientLobStatus(UUID recipientId, String deliveryStatus, LocalDateTime lastLobEventAt) {}
}
