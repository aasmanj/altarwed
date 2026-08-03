package com.altarwed.application.service;

import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.model.email.EmailOutboxEntry;
import com.altarwed.domain.model.email.EmailType;
import com.altarwed.domain.model.email.OutboxStatus;
import com.altarwed.domain.port.EmailOutboxRepository;
import com.altarwed.domain.port.EmailPort;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.javacrumbs.shedlock.core.LockAssert;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * End-to-end contract for the win-back touches across the durable outbox (issue #551): enqueueing
 * a nudge must persist a PENDING row whose type and payload the drain side can turn back into the
 * exact same EmailPort call.
 *
 * This is the regression that a new EmailType is easy to get wrong: {@code EmailOutboxSender}
 * switches over the enum without a default branch, and a switch statement over an enum is not
 * required to be exhaustive in Java, so a missing case compiles cleanly and then silently marks
 * every row of that type SENT without ever sending an email. Parameterising over the enum means
 * adding a fourth touch cannot regress this.
 */
@ExtendWith(MockitoExtension.class)
class CoupleWinbackOutboxRoundTripTest {

    @BeforeAll
    static void allowLockAssertOutsideRealSchedulerLock() {
        LockAssert.TestHelper.makeAllAssertsPass(true);
    }

    @Mock private EmailOutboxRepository outboxRepository;
    @Mock private EmailPort emailPort;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @ParameterizedTest
    @EnumSource(CoupleWinbackTouch.class)
    void everyTouchEnqueuesItsOwnTypeAndIsDispatchedBackToTheSameCall(CoupleWinbackTouch touch) {
        new AsyncEmailService(outboxRepository, objectMapper)
                .sendCoupleWinbackEmail("couple@example.com", "Hannah", "Micah", touch);

        ArgumentCaptor<EmailOutboxEntry> enqueued = ArgumentCaptor.forClass(EmailOutboxEntry.class);
        verify(outboxRepository).enqueue(enqueued.capture());
        EmailOutboxEntry entry = enqueued.getValue();

        assertThat(entry.type()).isEqualTo(touch.emailType());
        assertThat(entry.status()).isEqualTo(OutboxStatus.PENDING);
        assertThat(entry.attempts()).isZero();
        assertThat(entry.recipient()).isEqualTo("couple@example.com");

        // Drain the very row that was enqueued and assert it replays as the original send.
        when(outboxRepository.findSendable(any(), anyInt())).thenReturn(List.of(entry));
        new EmailOutboxSender(outboxRepository, emailPort, objectMapper).drain();

        verify(emailPort).sendCoupleWinbackEmail("couple@example.com", "Hannah", "Micah", touch);
        verify(outboxRepository).markSent(org.mockito.ArgumentMatchers.eq(entry.id()), any(LocalDateTime.class));
    }

    @ParameterizedTest
    @EnumSource(CoupleWinbackTouch.class)
    void eachTouchOwnsADistinctPersistedEmailType(CoupleWinbackTouch touch) {
        // The EmailType name is persisted in email_outbox.email_type, so this pins the mapping:
        // renaming one would orphan in-flight rows written by the old code.
        assertThat(touch.emailType()).isIn(
                EmailType.COUPLE_WINBACK_DAY_2,
                EmailType.COUPLE_WINBACK_DAY_7,
                EmailType.COUPLE_WINBACK_DAY_21);
        assertThat(touch.daysAfterSignup()).isPositive();
    }
}
