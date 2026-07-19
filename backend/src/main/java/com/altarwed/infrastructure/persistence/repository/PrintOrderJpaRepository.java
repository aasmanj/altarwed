package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.PrintOrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrintOrderJpaRepository extends JpaRepository<PrintOrderEntity, UUID> {
    List<PrintOrderEntity> findAllByCoupleIdOrderByCreatedAtDesc(UUID coupleId);
    Optional<PrintOrderEntity> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey);
    void deleteAllByCoupleId(UUID coupleId);

    // Issue #209: candidates for the lost-webhook reconciliation job. Status lives as a plain
    // NVARCHAR (no @Enumerated column), so the derived query takes the status name as a String,
    // consistent with the native queries below.
    List<PrintOrderEntity> findAllByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(String status, LocalDateTime cutoff);

    // Issue #59/#53: these four target only the specific columns they touch, native SQL,
    // deliberately bypassing the @OneToMany aggregate cascade/orphanRemoval on `recipients` (see
    // PrintOrderJpaAdapter's javadoc) so a payment/status transition or an incremental recipient
    // insert can never wipe recipients not present in an in-memory collection.

    @Modifying
    @Query(value = "UPDATE print_orders SET stripe_checkout_session_id = :sessionId WHERE id = :orderId",
            nativeQuery = true)
    void attachCheckoutSession(@Param("orderId") UUID orderId, @Param("sessionId") String stripeCheckoutSessionId);

    // Compare-and-swap (WHERE status = 'PENDING_PAYMENT'), not an unconditional UPDATE: Stripe
    // delivers webhooks at-least-once, so two concurrent checkout.session.completed deliveries
    // for the same order can both pass a check-then-act read/findById guard before either
    // commits. The returned row count is the only thing that safely tells the caller "I am the
    // one delivery that gets to trigger the batch" -- see StripeService's callers, which only
    // proceed when this returns 1.
    //
    // Deliberately does NOT rewrite amount_charged_cents from the webhook's reported total:
    // createOrder already computed and persisted the correct charged amount (payableCount * unit
    // price) BEFORE Stripe was even involved. Overwriting it here with event.amountTotalCents()
    // would silently null the column (and break submitBatchAsync's refund guard, which requires
    // a non-null amount) on the rare event Stripe's total is ever absent on a completed session.
    @Modifying
    @Query(value = """
            UPDATE print_orders
            SET status = 'PROCESSING', stripe_payment_intent_id = :paymentIntentId
            WHERE id = :orderId AND status = 'PENDING_PAYMENT'
            """, nativeQuery = true)
    int markPaymentConfirmed(@Param("orderId") UUID orderId, @Param("paymentIntentId") String paymentIntentId);

    @Modifying
    @Query(value = "UPDATE print_orders SET status = 'FAILED', error_message = :errorMessage WHERE id = :orderId AND status = 'PENDING_PAYMENT'",
            nativeQuery = true)
    int markPaymentFailed(@Param("orderId") UUID orderId, @Param("errorMessage") String errorMessage);

    @Modifying
    @Query(value = """
            UPDATE print_orders
            SET status = :status, error_message = :errorMessage, submitted_at = :submittedAt, cost_cents = :costCents
            WHERE id = :orderId
            """, nativeQuery = true)
    void finalizeOrder(@Param("orderId") UUID orderId, @Param("status") String status,
                        @Param("errorMessage") String errorMessage, @Param("submittedAt") LocalDateTime submittedAt,
                        @Param("costCents") Integer costCents);

    @Modifying
    @Query(value = "UPDATE print_orders SET amount_refunded_cents = :amountRefundedCents WHERE id = :orderId",
            nativeQuery = true)
    void recordRefund(@Param("orderId") UUID orderId, @Param("amountRefundedCents") Integer amountRefundedCents);

    // Direct insert into the child table, bypassing the aggregate entirely -- see the class
    // javadoc above. NEWID() default only applies on the CREATE TABLE default; an explicit
    // id is still required here since this bypasses PrintOrderRecipientEntity's @GeneratedValue.
    @Modifying
    @Query(value = """
            INSERT INTO print_order_recipients
                (id, print_order_id, guest_id, lob_postcard_id, delivery_status, error_message,
                 tracking_number, expected_delivery_date)
            VALUES
                (:id, :orderId, :guestId, :lobPostcardId, :deliveryStatus, :errorMessage,
                 :trackingNumber, :expectedDeliveryDate)
            """, nativeQuery = true)
    void insertRecipient(@Param("id") UUID id, @Param("orderId") UUID orderId, @Param("guestId") UUID guestId,
                         @Param("lobPostcardId") String lobPostcardId, @Param("deliveryStatus") String deliveryStatus,
                         @Param("errorMessage") String errorMessage, @Param("trackingNumber") String trackingNumber,
                         @Param("expectedDeliveryDate") LocalDate expectedDeliveryDate);

    @Modifying
    @Query(value = """
            UPDATE print_order_recipients
            SET lob_postcard_id = :lobPostcardId, delivery_status = :deliveryStatus, error_message = :errorMessage
            WHERE id = :recipientId
            """, nativeQuery = true)
    void updateRecipientOutcome(@Param("recipientId") UUID recipientId, @Param("lobPostcardId") String lobPostcardId,
                                @Param("deliveryStatus") String deliveryStatus, @Param("errorMessage") String errorMessage);

    // Issue #52: Lob webhook correlation + idempotent apply. Native/projection, same reasoning as
    // the four queries above -- a targeted read/write on this one child row, never touching the
    // @OneToMany aggregate.

    @Query(value = """
            SELECT id AS recipientId, delivery_status AS deliveryStatus, last_lob_event_at AS lastLobEventAt
            FROM print_order_recipients WHERE lob_postcard_id = :lobPostcardId
            """, nativeQuery = true)
    Optional<RecipientLobStatusRow> findRecipientLobStatus(@Param("lobPostcardId") String lobPostcardId);

    interface RecipientLobStatusRow {
        UUID getRecipientId();
        String getDeliveryStatus();
        LocalDateTime getLastLobEventAt();
    }

    @Modifying
    @Query(value = """
            UPDATE print_order_recipients
            SET delivery_status = :deliveryStatus,
                last_lob_event_at = :eventAt,
                tracking_number = COALESCE(:trackingNumber, tracking_number),
                expected_delivery_date = COALESCE(:expectedDeliveryDate, expected_delivery_date)
            WHERE id = :recipientId
            """, nativeQuery = true)
    void applyLobDeliveryEvent(@Param("recipientId") UUID recipientId, @Param("deliveryStatus") String deliveryStatus,
                               @Param("eventAt") LocalDateTime eventAt, @Param("trackingNumber") String trackingNumber,
                               @Param("expectedDeliveryDate") LocalDate expectedDeliveryDate);
}
