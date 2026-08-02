package com.altarwed.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * JPA entity for the couple_winback_touches table (V106), the send-once ledger for the couple
 * win-back sequence (issue #551). One row per (couple_id, touch); the unique constraint on that
 * pair is the hard dedupe guarantee (see the migration). The domain model is the pure
 * {@link com.altarwed.domain.model.email.CoupleWinbackTouch} enum plus the couple id; mapping
 * lives in {@link com.altarwed.infrastructure.persistence.CoupleWinbackTouchRepositoryAdapter}.
 *
 * The id is assigned by the adapter (a fresh UUID) rather than generated, matching the other
 * app-assigned-key tables. columnDefinition pins the SQL Server UNIQUEIDENTIFIER type per
 * backend/CLAUDE.md.
 */
@Entity
@Table(name = "couple_winback_touches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CoupleWinbackTouchEntity {

    @Id
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "UNIQUEIDENTIFIER")
    private UUID id;

    @Column(name = "couple_id", nullable = false, columnDefinition = "UNIQUEIDENTIFIER")
    private UUID coupleId;

    @Column(name = "touch", nullable = false, length = 16)
    private String touch;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;
}
