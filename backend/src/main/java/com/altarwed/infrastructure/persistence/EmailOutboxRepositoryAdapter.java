package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.email.EmailOutboxEntry;
import com.altarwed.domain.model.email.EmailType;
import com.altarwed.domain.model.email.OutboxStatus;
import com.altarwed.domain.port.EmailOutboxRepository;
import com.altarwed.infrastructure.persistence.entity.EmailOutboxEntity;
import com.altarwed.infrastructure.persistence.repository.EmailOutboxJpaRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * JPA adapter implementing the {@link EmailOutboxRepository} port. Maps between the
 * pure-domain {@link EmailOutboxEntry} and the {@link EmailOutboxEntity}.
 *
 * enqueue delegates to the Spring Data save (propagation REQUIRED), so when a business
 * service calls it inside its own @Transactional method the outbox row commits or rolls
 * back atomically with that change. The mark* methods are individually transactional on
 * the JPA repository, keeping each row's outcome an independent unit of work.
 */
@Component
public class EmailOutboxRepositoryAdapter implements EmailOutboxRepository {

    private final EmailOutboxJpaRepository jpa;

    public EmailOutboxRepositoryAdapter(EmailOutboxJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public void enqueue(EmailOutboxEntry entry) {
        jpa.save(toEntity(entry));
    }

    @Override
    public List<EmailOutboxEntry> findSendable(LocalDateTime now, int limit) {
        return jpa.findByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
                        OutboxStatus.PENDING.name(), now, PageRequest.of(0, limit))
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public void markSent(UUID id, LocalDateTime sentAt) {
        jpa.markSent(id, sentAt);
    }

    @Override
    public void markForRetry(UUID id, int attempts, LocalDateTime nextAttemptAt, String lastError) {
        jpa.markForRetry(id, attempts, nextAttemptAt, lastError);
    }

    @Override
    public void markFailed(UUID id, int attempts, String lastError) {
        jpa.markFailed(id, attempts, lastError);
    }

    private EmailOutboxEntry toDomain(EmailOutboxEntity e) {
        return new EmailOutboxEntry(
                e.getId(),
                EmailType.valueOf(e.getEmailType()),
                e.getRecipient(),
                e.getPayload(),
                OutboxStatus.valueOf(e.getStatus()),
                e.getAttempts(),
                e.getNextAttemptAt(),
                e.getCreatedAt(),
                e.getSentAt(),
                e.getLastError());
    }

    private EmailOutboxEntity toEntity(EmailOutboxEntry d) {
        return EmailOutboxEntity.builder()
                .id(d.id())
                .emailType(d.type().name())
                .recipient(d.recipient())
                .payload(d.payload())
                .status(d.status().name())
                .attempts(d.attempts())
                .nextAttemptAt(d.nextAttemptAt())
                .createdAt(d.createdAt())
                .sentAt(d.sentAt())
                .lastError(d.lastError())
                .build();
    }
}
