package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * JPA mapping for vendor_promo_redemptions (migration V75): the append-only audit row written on
 * each successful comp redemption. No PII is stored here, only the code_id and vendor_id UUIDs.
 */
@Entity
@Table(name = "vendor_promo_redemptions")
public class VendorPromoRedemptionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(columnDefinition = "UNIQUEIDENTIFIER")
    private UUID id;

    @Column(name = "code_id", nullable = false, columnDefinition = "UNIQUEIDENTIFIER")
    private UUID codeId;

    @Column(name = "vendor_id", nullable = false, columnDefinition = "UNIQUEIDENTIFIER")
    private UUID vendorId;

    @Column(name = "redeemed_at", nullable = false, columnDefinition = "DATETIMEOFFSET")
    private OffsetDateTime redeemedAt;

    @PrePersist
    public void prePersist() {
        if (redeemedAt == null) redeemedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getCodeId() { return codeId; }
    public void setCodeId(UUID codeId) { this.codeId = codeId; }
    public UUID getVendorId() { return vendorId; }
    public void setVendorId(UUID vendorId) { this.vendorId = vendorId; }
    public OffsetDateTime getRedeemedAt() { return redeemedAt; }
    public void setRedeemedAt(OffsetDateTime redeemedAt) { this.redeemedAt = redeemedAt; }
}
