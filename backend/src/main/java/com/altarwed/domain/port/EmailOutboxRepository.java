package com.altarwed.domain.port;

import com.altarwed.domain.model.email.EmailOutboxEntry;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Persistence port for the durable email outbox (issue #377).
 *
 * enqueue is called inside the business transaction so the send-intent row commits
 * atomically with the change that triggered it. The remaining methods are driven by
 * the scheduled outbox sender as it drains the queue.
 */
public interface EmailOutboxRepository {

    /**
     * Persists a new send-intent row. Participates in the caller's transaction when one
     * is active, so the row and the business change commit or roll back together.
     */
    void enqueue(EmailOutboxEntry entry);

    /**
     * Rows eligible to send now: status PENDING with next_attempt_at &lt;= {@code now},
     * oldest first, capped at {@code limit} so one poll never processes an unbounded batch.
     */
    List<EmailOutboxEntry> findSendable(LocalDateTime now, int limit);

    /** Marks a row delivered (terminal). */
    void markSent(UUID id, LocalDateTime sentAt);

    /** Records a transient failure and schedules the next attempt (stays PENDING). */
    void markForRetry(UUID id, int attempts, LocalDateTime nextAttemptAt, String lastError);

    /** Marks a row permanently failed after the retry budget is exhausted (terminal). */
    void markFailed(UUID id, int attempts, String lastError);
}
