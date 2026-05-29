package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

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

    @Column(name = "guest_id", nullable = false)
    private UUID guestId;

    @Column(name = "lob_postcard_id", length = 64)
    private String lobPostcardId;

    @Column(name = "delivery_status", length = 32)
    private String deliveryStatus;

    @Column(name = "error_message", length = 500)
    private String errorMessage;
}
