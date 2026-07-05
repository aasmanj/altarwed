package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "save_the_date_sends")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaveTheDateSendEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "couple_id", nullable = false)
    private UUID coupleId;

    @Column(name = "idempotency_key", nullable = false, length = 64)
    private String idempotencyKey;

    @Column(name = "queued_count", nullable = false)
    private Integer queuedCount;

    @Column(name = "invalid_count", nullable = false)
    private Integer invalidCount;

    @Column(name = "suppressed_count", nullable = false)
    private Integer suppressedCount;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
