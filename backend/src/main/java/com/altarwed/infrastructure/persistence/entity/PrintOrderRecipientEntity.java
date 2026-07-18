package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "print_order_recipients")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrintOrderRecipientEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    // Read-only back-reference. The FK is written by the parent's @OneToMany
    // @JoinColumn(name="print_order_id", nullable=false). Keep insertable/updatable
    // false here, without it Hibernate sees two writers for the same column and
    // throws MappingException at startup.
    @Column(name = "print_order_id", nullable = false, insertable = false, updatable = false)
    private UUID printOrderId;

    // Nullable since V98 (issue #208): a TEST_PROOF recipient is the couple themselves,
    // addressed via the parent order's return_* block, not a guest row.
    @Column(name = "guest_id")
    private UUID guestId;

    @Column(name = "lob_postcard_id", length = 64)
    private String lobPostcardId;

    @Column(name = "delivery_status", length = 32)
    private String deliveryStatus;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "tracking_number", length = 64)
    private String trackingNumber;

    @Column(name = "expected_delivery_date")
    private LocalDate expectedDeliveryDate;

    // Issue #52: timestamp of the last-applied Lob webhook event, mirroring vendor_subscriptions
    // .last_stripe_event_at (V84). Entity-only (not on the PrintOrderRecipient domain record):
    // it exists solely for the webhook idempotency decision in LobWebhookService, which reads
    // and writes it directly through PrintOrderRepository's native queries without round-tripping
    // through the couple-facing PrintOrderService (out of scope for issue #52 to touch).
    //
    // insertable/updatable = false for the same reason as printOrderId above, but a different
    // failure mode: PrintOrderService.refreshDeliveryStatuses (issue #59 polling) calls the
    // aggregate save() path (toEntity -> toRecipientEntity), which rebuilds this entity from the
    // PrintOrderRecipient domain record. Since that record has no lastLobEventAt field, an ORM-
    // writable column here would get silently nulled by every poll, destroying the same-rank
    // duplicate-event timestamp tiebreak in LobWebhookService the very next time a webhook (even
    // a harmless redelivery) arrived. Marking it non-writable means only the native
    // applyLobDeliveryEvent UPDATE (which bypasses ORM column mapping) ever touches this column.
    @Column(name = "last_lob_event_at", insertable = false, updatable = false)
    private LocalDateTime lastLobEventAt;
}
