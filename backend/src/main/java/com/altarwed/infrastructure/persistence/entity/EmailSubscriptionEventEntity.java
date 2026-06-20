package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One immutable row per email subscription state change (append-only audit trail).
 * See V68 migration for why this exists alongside the current-state
 * {@link EmailSuppressionEntity}.
 */
@Entity
@Table(name = "email_subscription_event")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailSubscriptionEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "email_hash", nullable = false, length = 64)
    private String emailHash;

    // Which couple relationship this event belongs to, or null for a global,
    // address-level event (a bounce or spam complaint that is not couple-scoped).
    @Column(name = "couple_id")
    private UUID coupleId;

    // SUPPRESSED or RESUBSCRIBED (enforced by a DB CHECK constraint).
    @Column(name = "action", nullable = false, length = 20)
    private String action;

    // Reason/initiator: USER_REQUEST / BOUNCE / COMPLAINT (suppression) or
    // GUEST_RSVP (resubscribe, the guest re-consented by RSVPing).
    @Column(name = "source", nullable = false, length = 50)
    private String source;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
