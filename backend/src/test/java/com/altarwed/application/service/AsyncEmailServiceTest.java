package com.altarwed.application.service;

import com.altarwed.domain.model.RsvpInviteRecipient;
import com.altarwed.domain.model.email.EmailOutboxEntry;
import com.altarwed.domain.model.email.EmailType;
import com.altarwed.domain.model.email.OutboxPayloads;
import com.altarwed.domain.model.email.OutboxStatus;
import com.altarwed.domain.port.EmailOutboxRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

/**
 * Unit tests for {@link AsyncEmailService}, the enqueue side of the durable outbox (issue #377).
 *
 * The contract under test: every send method persists exactly one PENDING outbox row whose
 * payload round-trips back to the original arguments. This is the "enqueue persists a row" leg
 * of the transactional outbox and the reason a restart can no longer drop queued mail.
 */
@ExtendWith(MockitoExtension.class)
class AsyncEmailServiceTest {

    @Mock private EmailOutboxRepository outboxRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AsyncEmailService service() {
        return new AsyncEmailService(outboxRepository, objectMapper);
    }

    @Test
    void singleSendEnqueuesOnePendingRowWithRoundTrippablePayload() throws Exception {
        service().sendWelcomeEmail("bride@example.com", "Bride", "Groom");

        ArgumentCaptor<EmailOutboxEntry> captor = ArgumentCaptor.forClass(EmailOutboxEntry.class);
        verify(outboxRepository).enqueue(captor.capture());
        EmailOutboxEntry entry = captor.getValue();

        assertThat(entry.type()).isEqualTo(EmailType.WELCOME);
        assertThat(entry.status()).isEqualTo(OutboxStatus.PENDING);
        assertThat(entry.attempts()).isZero();
        assertThat(entry.id()).isNotNull();
        assertThat(entry.recipient()).isEqualTo("bride@example.com");
        assertThat(entry.nextAttemptAt()).isNotNull();
        assertThat(entry.sentAt()).isNull();

        OutboxPayloads.Welcome payload =
                objectMapper.readValue(entry.payload(), OutboxPayloads.Welcome.class);
        assertThat(payload.toEmail()).isEqualTo("bride@example.com");
        assertThat(payload.partnerOneName()).isEqualTo("Bride");
        assertThat(payload.partnerTwoName()).isEqualTo("Groom");
    }

    @Test
    void batchSendEnqueuesSingleRowWithNullRecipientAndAllRecipientsInPayload() throws Exception {
        UUID coupleId = UUID.randomUUID();
        List<RsvpInviteRecipient> recipients = List.of(
                new RsvpInviteRecipient("a@example.com", "A", UUID.randomUUID(), "tokenA"),
                new RsvpInviteRecipient("b@example.com", "B", UUID.randomUUID(), "tokenB"));

        service().sendRsvpInviteEmails(recipients, coupleId, "Bride and Groom", "2026-09-01", "reply@example.com");

        ArgumentCaptor<EmailOutboxEntry> captor = ArgumentCaptor.forClass(EmailOutboxEntry.class);
        verify(outboxRepository).enqueue(captor.capture());
        EmailOutboxEntry entry = captor.getValue();

        assertThat(entry.type()).isEqualTo(EmailType.RSVP_INVITE_BATCH);
        assertThat(entry.recipient()).isNull();

        OutboxPayloads.RsvpInviteBatch payload =
                objectMapper.readValue(entry.payload(), OutboxPayloads.RsvpInviteBatch.class);
        assertThat(payload.recipients()).hasSize(2);
        assertThat(payload.recipients().get(0).email()).isEqualTo("a@example.com");
        assertThat(payload.recipients().get(1).rsvpToken()).isEqualTo("tokenB");
        assertThat(payload.coupleId()).isEqualTo(coupleId);
    }
}
