package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Receipt row for the one-time vendor listing-completion nudge (issue #557). Table
 * vendor_listing_nudge_sends, created in V104, carries a UNIQUE constraint on vendor_id, so
 * an insert for a vendor that already has a receipt fails and rolls back the caller's
 * transaction. That is the dedup guarantee, not a convention.
 */
@Entity
@Table(name = "vendor_listing_nudge_sends")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VendorListingNudgeSendEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "vendor_id", nullable = false, unique = true, updatable = false)
    private UUID vendorId;

    @Column(name = "sent_at", nullable = false, updatable = false)
    private LocalDateTime sentAt;

    @PrePersist
    void onCreate() {
        if (sentAt == null) sentAt = LocalDateTime.now();
    }
}
