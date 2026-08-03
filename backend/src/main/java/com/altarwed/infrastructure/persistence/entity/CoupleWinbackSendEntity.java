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
 * JPA entity for the couple_winback_sends table (V108), the send-once ledger of the couple
 * activation win-back sequence (issue #551).
 *
 * There is no domain counterpart record: the table is pure bookkeeping for
 * {@link com.altarwed.application.service.CoupleWinbackService}, and the domain expresses it as
 * behaviour on {@link com.altarwed.domain.port.CoupleWinbackRepository} rather than as a value the
 * rest of the application passes around.
 *
 * The id is assigned by the application rather than generated so the insert needs no round trip to
 * read a key back. columnDefinition pins the SQL Server type (UNIQUEIDENTIFIER) per
 * backend/CLAUDE.md; touch is a plain NVARCHAR holding the CoupleWinbackTouch enum name.
 */
@Entity
@Table(name = "couple_winback_sends")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CoupleWinbackSendEntity {

    @Id
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "UNIQUEIDENTIFIER")
    private UUID id;

    @Column(name = "couple_id", nullable = false, updatable = false, columnDefinition = "UNIQUEIDENTIFIER")
    private UUID coupleId;

    @Column(name = "touch", nullable = false, length = 16)
    private String touch;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;
}
