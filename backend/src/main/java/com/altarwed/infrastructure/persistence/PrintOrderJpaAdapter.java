package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.PrintOrder;
import com.altarwed.domain.model.PrintOrderRecipient;
import com.altarwed.domain.model.PrintOrderStatus;
import com.altarwed.domain.model.PrintOrderType;
import com.altarwed.domain.port.PrintOrderRepository;
import com.altarwed.domain.port.PrintOrderRepository.RecipientLobStatus;
import com.altarwed.infrastructure.persistence.entity.PrintOrderEntity;
import com.altarwed.infrastructure.persistence.entity.PrintOrderRecipientEntity;
import com.altarwed.infrastructure.persistence.repository.PrintOrderJpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class PrintOrderJpaAdapter implements PrintOrderRepository {

    private final PrintOrderJpaRepository jpa;

    public PrintOrderJpaAdapter(PrintOrderJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public PrintOrder save(PrintOrder order) {
        PrintOrderEntity entity = toEntity(order);
        return toDomain(jpa.save(entity));
    }

    @Override
    public Optional<PrintOrder> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public List<PrintOrder> findAllByCoupleId(UUID coupleId) {
        return jpa.findAllByCoupleIdOrderByCreatedAtDesc(coupleId).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<PrintOrder> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey) {
        return jpa.findByCoupleIdAndIdempotencyKey(coupleId, idempotencyKey).map(this::toDomain);
    }

    @Override
    public void deleteAllByCoupleId(UUID coupleId) {
        jpa.deleteAllByCoupleId(coupleId);
    }

    // REQUIRES_NEW on every method below (not the default REQUIRED): each must be independently,
    // immediately durable regardless of the caller's transactional context. This matters concretely
    // for markPaymentConfirmed/markPaymentFailed, called from StripeService.handleWebhook (itself
    // @Transactional) immediately before triggering the async Lob batch (issue #53/#59) -- with
    // default propagation these writes would join the webhook's ambient transaction and might not
    // be committed yet when the async thread's own findById reads the row, causing it to see the
    // stale pre-webhook status and skip the batch entirely.

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void appendRecipient(UUID orderId, PrintOrderRecipient recipient) {
        jpa.insertRecipient(
                UUID.randomUUID(), orderId, recipient.guestId(), recipient.lobPostcardId(),
                recipient.deliveryStatus(), recipient.errorMessage(),
                recipient.trackingNumber(), recipient.expectedDeliveryDate());
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateRecipientOutcome(UUID recipientId, String lobPostcardId, String deliveryStatus, String errorMessage) {
        jpa.updateRecipientOutcome(recipientId, lobPostcardId, deliveryStatus, errorMessage);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void attachCheckoutSession(UUID orderId, String stripeCheckoutSessionId) {
        jpa.attachCheckoutSession(orderId, stripeCheckoutSessionId);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean markPaymentConfirmed(UUID orderId, String stripePaymentIntentId) {
        return jpa.markPaymentConfirmed(orderId, stripePaymentIntentId) == 1;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean markPaymentFailed(UUID orderId, String errorMessage) {
        return jpa.markPaymentFailed(orderId, errorMessage) == 1;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finalizeOrder(UUID orderId, PrintOrderStatus status, String errorMessage,
                               LocalDateTime submittedAt, Integer costCents) {
        jpa.finalizeOrder(orderId, status.name(), errorMessage, submittedAt, costCents);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRefund(UUID orderId, Integer amountRefundedCents) {
        jpa.recordRefund(orderId, amountRefundedCents);
    }

    // Issue #52: unlike the block above, REQUIRES_NEW here is not escaping a Stripe-webhook
    // ambient transaction (LobWebhookService.process() is not itself @Transactional, so there is
    // no ambient transaction to suspend) -- it is just each call getting its own independently
    // durable transaction, consistent with the rest of this adapter's targeted single-row writes.
    // The read (below) and the write are two separate transactions; this is a deliberately looser
    // read-then-decide-then-write (not a SQL-level compare-and-swap) matching EmailDeliveryService's
    // approach for the analogous Resend webhook case -- acceptable for a display-only delivery
    // status where the worst case is a transiently wrong value a later event corrects, given Lob's
    // webhook redelivery/concurrency profile is no higher-throughput than Resend's.

    @Override
    @Transactional(readOnly = true)
    public Optional<RecipientLobStatus> findRecipientLobStatus(String lobPostcardId) {
        return jpa.findRecipientLobStatus(lobPostcardId)
                .map(row -> new RecipientLobStatus(row.getRecipientId(), row.getDeliveryStatus(), row.getLastLobEventAt()));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void applyLobDeliveryEvent(UUID recipientId, String deliveryStatus, LocalDateTime eventAt,
                                       String trackingNumber, LocalDate expectedDeliveryDate) {
        jpa.applyLobDeliveryEvent(recipientId, deliveryStatus, eventAt, trackingNumber, expectedDeliveryDate);
    }

    private PrintOrderEntity toEntity(PrintOrder o) {
        PrintOrderEntity e = PrintOrderEntity.builder()
                .id(o.id())
                .coupleId(o.coupleId())
                .idempotencyKey(o.idempotencyKey())
                .orderType(o.orderType().name())
                .status(o.status().name())
                .templateKey(o.templateKey())
                .recipientCount(o.recipientCount())
                .costCents(o.costCents())
                .errorMessage(o.errorMessage())
                .createdAt(o.createdAt())
                .submittedAt(o.submittedAt())
                .stripeCheckoutSessionId(o.stripeCheckoutSessionId())
                .stripePaymentIntentId(o.stripePaymentIntentId())
                .amountChargedCents(o.amountChargedCents())
                .amountRefundedCents(o.amountRefundedCents() != null ? o.amountRefundedCents() : 0)
                .returnName(o.returnName())
                .returnAddressLine1(o.returnAddressLine1())
                .returnAddressLine2(o.returnAddressLine2())
                .returnCity(o.returnCity())
                .returnState(o.returnState())
                .returnZip(o.returnZip())
                .cardSize(o.cardSize())
                .build();
        if (o.recipients() != null) {
            // Must be a MUTABLE list: Hibernate manages this @OneToMany collection
            // (orphanRemoval + merge on the final update) and cannot mutate an
            // immutable Stream.toList() result, it throws UnsupportedOperationException.
            e.setRecipients(new ArrayList<>(
                    o.recipients().stream().map(this::toRecipientEntity).toList()));
        }
        return e;
    }

    private PrintOrderRecipientEntity toRecipientEntity(PrintOrderRecipient r) {
        return PrintOrderRecipientEntity.builder()
                .id(r.id())
                .guestId(r.guestId())
                .lobPostcardId(r.lobPostcardId())
                .deliveryStatus(r.deliveryStatus())
                .errorMessage(r.errorMessage())
                .trackingNumber(r.trackingNumber())
                .expectedDeliveryDate(r.expectedDeliveryDate())
                .build();
    }

    private PrintOrder toDomain(PrintOrderEntity e) {
        return new PrintOrder(
                e.getId(),
                e.getCoupleId(),
                PrintOrderType.valueOf(e.getOrderType()),
                PrintOrderStatus.valueOf(e.getStatus()),
                e.getTemplateKey(),
                e.getRecipientCount(),
                e.getCostCents(),
                e.getErrorMessage(),
                e.getCreatedAt(),
                e.getSubmittedAt(),
                e.getRecipients().stream().map(this::toRecipientDomain).toList(),
                e.getIdempotencyKey(),
                e.getStripeCheckoutSessionId(),
                e.getStripePaymentIntentId(),
                e.getAmountChargedCents(),
                e.getAmountRefundedCents(),
                e.getReturnName(),
                e.getReturnAddressLine1(),
                e.getReturnAddressLine2(),
                e.getReturnCity(),
                e.getReturnState(),
                e.getReturnZip(),
                e.getCardSize()
        );
    }

    private PrintOrderRecipient toRecipientDomain(PrintOrderRecipientEntity r) {
        return new PrintOrderRecipient(
                r.getId(),
                r.getPrintOrderId(),
                r.getGuestId(),
                r.getLobPostcardId(),
                r.getDeliveryStatus(),
                r.getErrorMessage(),
                r.getTrackingNumber(),
                r.getExpectedDeliveryDate()
        );
    }
}
