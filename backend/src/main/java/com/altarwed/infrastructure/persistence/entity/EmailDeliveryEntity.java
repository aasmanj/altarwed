package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "email_delivery")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailDeliveryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "resend_email_id", nullable = false, length = 100, unique = true)
    private String resendEmailId;

    @Column(name = "guest_id")
    private UUID guestId;

    @Column(name = "couple_id")
    private UUID coupleId;

    @Column(name = "email_type", nullable = false, length = 40)
    private String emailType;

    @Column(name = "recipient_email_hash", length = 64)
    private String recipientEmailHash;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "bounce_type", length = 20)
    private String bounceType;

    @Column(name = "bounce_subtype", length = 50)
    private String bounceSubtype;

    @Column(name = "last_event_at", nullable = false)
    private LocalDateTime lastEventAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
