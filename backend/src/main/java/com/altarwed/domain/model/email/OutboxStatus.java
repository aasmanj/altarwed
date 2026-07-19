package com.altarwed.domain.model.email;

/**
 * Lifecycle of a single durable email send-intent row in the email_outbox table.
 *
 * PENDING: enqueued, not yet delivered. Picked up by the outbox sender when
 *          next_attempt_at &lt;= now.
 * SENT:    the EmailPort accepted the send. Terminal, never re-processed.
 * FAILED:  gave up after the bounded retry budget was exhausted. Terminal; a
 *          human (or a future replay job) decides what to do with it.
 */
public enum OutboxStatus {
    PENDING,
    SENT,
    FAILED
}
