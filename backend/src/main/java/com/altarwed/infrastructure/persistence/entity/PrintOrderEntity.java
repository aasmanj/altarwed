package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "print_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrintOrderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "couple_id", nullable = false)
    private UUID coupleId;

    @Column(name = "idempotency_key", length = 64)
    private String idempotencyKey;

    @Column(name = "order_type", nullable = false, length = 32)
    private String orderType;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "template_key", nullable = false, length = 64)
    private String templateKey;

    @Column(name = "recipient_count", nullable = false)
    private Integer recipientCount;

    @Column(name = "cost_cents", nullable = false)
    private Integer costCents;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "stripe_checkout_session_id", length = 255)
    private String stripeCheckoutSessionId;

    @Column(name = "stripe_payment_intent_id", length = 255)
    private String stripePaymentIntentId;

    @Column(name = "amount_charged_cents")
    private Integer amountChargedCents;

    @Column(name = "amount_refunded_cents", nullable = false)
    private Integer amountRefundedCents;

    @Column(name = "return_name", length = 200)
    private String returnName;

    @Column(name = "return_address_line1", length = 200)
    private String returnAddressLine1;

    @Column(name = "return_address_line2", length = 200)
    private String returnAddressLine2;

    @Column(name = "return_city", length = 100)
    private String returnCity;

    @Column(name = "return_state", length = 50)
    private String returnState;

    @Column(name = "return_zip", length = 20)
    private String returnZip;

    @Column(name = "card_size", length = 20)
    private String cardSize;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "print_order_id", nullable = false)
    @Builder.Default
    private List<PrintOrderRecipientEntity> recipients = new ArrayList<>();

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
