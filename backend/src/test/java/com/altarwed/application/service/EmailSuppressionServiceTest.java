package com.altarwed.application.service;

import com.altarwed.domain.port.EmailSuppressionPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Locks in the resubscribe policy: which suppression sources can be reversed, that the
 * reversal is audited as a COUPLE_REQUEST, and that a spam complaint is never auto-reversed
 * (protecting the shared sending-domain reputation). The gating lives here, not in the UI,
 * so a crafted API call cannot bypass it.
 */
@ExtendWith(MockitoExtension.class)
class EmailSuppressionServiceTest {

    @Mock private EmailSuppressionPort port;

    private EmailSuppressionService service() {
        return new EmailSuppressionService(port, "test-secret");
    }

    private static final String HASH = "deadbeef";

    @Test
    void resubscribe_removesSuppression_andAuditsAsCoupleRequest_whenUserUnsubscribed() {
        when(port.suppressionSource(HASH)).thenReturn(Optional.of("USER_REQUEST"));
        when(port.unsuppress(HASH, "COUPLE_REQUEST")).thenReturn(true);

        assertThat(service().resubscribe(HASH))
                .isEqualTo(EmailSuppressionService.ResubscribeOutcome.RESUBSCRIBED);
        verify(port).unsuppress(HASH, "COUPLE_REQUEST");
    }

    @Test
    void resubscribe_isAllowed_whenAddressBounced() {
        when(port.suppressionSource(HASH)).thenReturn(Optional.of("BOUNCE"));
        when(port.unsuppress(HASH, "COUPLE_REQUEST")).thenReturn(true);

        assertThat(service().resubscribe(HASH))
                .isEqualTo(EmailSuppressionService.ResubscribeOutcome.RESUBSCRIBED);
        verify(port).unsuppress(HASH, "COUPLE_REQUEST");
    }

    @Test
    void resubscribe_reportsNoOp_whenAConcurrentResubscribeRemovedTheRowFirst() {
        // Row was present at the source check but already gone by the time we deleted it.
        when(port.suppressionSource(HASH)).thenReturn(Optional.of("USER_REQUEST"));
        when(port.unsuppress(HASH, "COUPLE_REQUEST")).thenReturn(false);

        assertThat(service().resubscribe(HASH))
                .isEqualTo(EmailSuppressionService.ResubscribeOutcome.NOT_SUPPRESSED);
    }

    @Test
    void resubscribe_isRefused_andNeverRemoves_whenPriorSpamComplaint() {
        when(port.suppressionSource(HASH)).thenReturn(Optional.of("COMPLAINT"));

        assertThat(service().resubscribe(HASH))
                .isEqualTo(EmailSuppressionService.ResubscribeOutcome.BLOCKED_COMPLAINT);
        verify(port, never()).unsuppress(anyString(), anyString());
    }

    @Test
    void resubscribe_isNoOp_whenAddressWasNotSuppressed() {
        when(port.suppressionSource(HASH)).thenReturn(Optional.empty());

        assertThat(service().resubscribe(HASH))
                .isEqualTo(EmailSuppressionService.ResubscribeOutcome.NOT_SUPPRESSED);
        verify(port, never()).unsuppress(anyString(), anyString());
    }
}
