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
 * JPA entity for the email_outbox table (V96). The domain type is
 * {@link com.altarwed.domain.model.email.EmailOutboxEntry}; mapping lives in
 * {@link com.altarwed.infrastructure.persistence.EmailOutboxRepositoryAdapter}.
 *
 * The id is assigned by the application (the domain factory mints the UUID) rather
 * than generated, so an enqueued entry keeps a stable id across the enqueue/send
 * lifecycle. columnDefinition pins the SQL Server types (UNIQUEIDENTIFIER,
 * NVARCHAR(MAX)) per backend/CLAUDE.md.
 */
@Entity
@Table(name = "email_outbox")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailOutboxEntity {

    @Id
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "UNIQUEIDENTIFIER")
    private UUID id;

    @Column(name = "email_type", nullable = false, length = 64)
    private String emailType;

    @Column(name = "recipient", length = 320)
    private String recipient;

    @Column(name = "payload", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String payload;

    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "last_error", length = 2000)
    private String lastError;
}
