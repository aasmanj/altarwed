package com.altarwed.application.service;

import com.altarwed.domain.model.email.EmailOutboxEntry;
import com.altarwed.domain.model.email.EmailType;
import com.altarwed.domain.model.email.OutboxPayloads;
import com.altarwed.domain.model.email.OutboxStatus;
import com.altarwed.domain.port.EmailOutboxRepository;
import com.altarwed.domain.port.EmailPort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.javacrumbs.shedlock.core.LockAssert;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_SMART_NULLS;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link EmailOutboxSender}, the drain side of the durable outbox (issue #377).
 *
 * Covers the state machine the reliability fix depends on:
 *   - a PENDING row is sent through the EmailPort and marked SENT (exactly once),
 *   - a transient failure increments attempts and schedules a backed-off retry (stays PENDING),
 *   - an exhausted row is parked FAILED and not retried,
 *   - findSendable only returns PENDING rows, so a SENT row is never re-sent.
 */
@ExtendWith(MockitoExtension.class)
class EmailOutboxSenderTest {

    @BeforeAll
    static void allowLockAssertOutsideRealSchedulerLock() {
        // drain() calls LockAssert.assertLocked(); these tests build the sender with plain `new`
        // and no Spring AOP proxy, so there is never a real lock. Mirrors RsvpReminderServiceTest.
        LockAssert.TestHelper.makeAllAssertsPass(true);
    }

    @Mock private EmailOutboxRepository outboxRepository;
    @Mock private EmailPort emailPort;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private EmailOutboxSender sender() {
        return new EmailOutboxSender(outboxRepository, emailPort, objectMapper);
    }

    private EmailOutboxEntry welcomeEntry(int attempts) throws JsonProcessingException {
        String payload = objectMapper.writeValueAsString(
                new OutboxPayloads.Welcome("bride@example.com", "Bride", "Groom"));
        LocalDateTime now = LocalDateTime.now();
        return new EmailOutboxEntry(UUID.randomUUID(), EmailType.WELCOME, "bride@example.com",
                payload, OutboxStatus.PENDING, attempts, now, now, null, null);
    }

    @Test
    void sendsPendingRowThroughPortAndMarksSentExactlyOnce() throws Exception {
        EmailOutboxEntry entry = welcomeEntry(0);
        when(outboxRepository.findSendable(any(LocalDateTime.class), anyInt())).thenReturn(List.of(entry));

        sender().drain();

        // Dispatched exactly once (no double-send within a run) with the rehydrated arguments.
        verify(emailPort, times(1)).sendWelcomeEmail("bride@example.com", "Bride", "Groom");
        verify(outboxRepository).markSent(eq(entry.id()), any(LocalDateTime.class));
        verify(outboxRepository, never()).markForRetry(any(), anyInt(), any(), any());
        verify(outboxRepository, never()).markFailed(any(), anyInt(), any());
    }

    @Test
    void transientFailureIncrementsAttemptsAndSchedulesBackoff() throws Exception {
        EmailOutboxEntry entry = welcomeEntry(0);
        when(outboxRepository.findSendable(any(LocalDateTime.class), anyInt())).thenReturn(List.of(entry));
        doThrow(new RuntimeException("provider 503"))
                .when(emailPort).sendWelcomeEmail(any(), any(), any());

        LocalDateTime before = LocalDateTime.now();
        sender().drain();

        ArgumentCaptor<Integer> attempts = ArgumentCaptor.forClass(Integer.class);
        ArgumentCaptor<LocalDateTime> nextAttempt = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(outboxRepository).markForRetry(eq(entry.id()), attempts.capture(), nextAttempt.capture(), any());
        assertThat(attempts.getValue()).isEqualTo(1);
        // Backoff pushes the next attempt into the future rather than retrying immediately.
        assertThat(nextAttempt.getValue()).isAfter(before);

        verify(outboxRepository, never()).markSent(any(), any());
        verify(outboxRepository, never()).markFailed(any(), anyInt(), any());
    }

    @Test
    void exhaustedRowIsMarkedFailedAndNotRetried() throws Exception {
        // attempts already at MAX_ATTEMPTS - 1, so the next failure is the terminal one.
        EmailOutboxEntry entry = welcomeEntry(EmailOutboxSender.MAX_ATTEMPTS - 1);
        when(outboxRepository.findSendable(any(LocalDateTime.class), anyInt())).thenReturn(List.of(entry));
        doThrow(new RuntimeException("permanent bounce"))
                .when(emailPort).sendWelcomeEmail(any(), any(), any());

        sender().drain();

        verify(outboxRepository).markFailed(eq(entry.id()), eq(EmailOutboxSender.MAX_ATTEMPTS), any());
        verify(outboxRepository, never()).markForRetry(any(), anyInt(), any(), any());
        verify(outboxRepository, never()).markSent(any(), any());
    }

    @Test
    void neverDoubleSendsBecauseDrainQueriesOnlyPendingRows() {
        // The guard against re-sending an already-delivered row is the query itself: the sender
        // asks for PENDING rows only, so a SENT row is never handed to it. Here the queue is empty
        // (as it would be once every row is SENT) and nothing is dispatched.
        when(outboxRepository.findSendable(any(LocalDateTime.class), anyInt())).thenReturn(List.of());

        sender().drain();

        verifyNoInteractions(emailPort);
        verify(outboxRepository, never()).markSent(any(), any());
    }

    @Test
    void findSendableIsCalledWithPendingBoundedBatch() {
        // Belt-and-braces: assert the drain caps its batch so one poll cannot pull an unbounded set.
        EmailPort unusedPort = mock(EmailPort.class, RETURNS_SMART_NULLS);
        when(outboxRepository.findSendable(any(LocalDateTime.class), eq(EmailOutboxSender.BATCH_LIMIT)))
                .thenReturn(List.of());

        new EmailOutboxSender(outboxRepository, unusedPort, objectMapper).drain();

        verify(outboxRepository).findSendable(any(LocalDateTime.class), eq(EmailOutboxSender.BATCH_LIMIT));
    }
}
