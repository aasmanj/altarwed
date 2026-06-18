package com.altarwed.application.service;

import com.altarwed.domain.model.EmailRecipient;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.RsvpInviteTokenRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link GuestService#sendSaveDates}, the save-the-date batch send.
 *
 * These lock in the behavior added with the save_the_date_sent_at column (V66):
 *   1. Only guests with a usable email are sent to (and stamped).
 *   2. An optional guestIds subset narrows the batch.
 *   3. The send stamps save_the_date_sent_at for exactly the sent guests, in one
 *      bulk UPDATE, so the dashboard can show who has and has not been emailed.
 *   4. An empty eligible set is a clean no-op (no async email, no stamp).
 */
@ExtendWith(MockitoExtension.class)
class GuestServiceTest {

    @Mock private GuestRepository guestRepository;
    @Mock private RsvpInviteTokenRepository tokenRepository;
    @Mock private WeddingWebsiteRepository websiteRepository;
    @Mock private CoupleRepository coupleRepository;
    @Mock private AsyncEmailService asyncEmailService;

    private GuestService service() {
        return new GuestService(guestRepository, tokenRepository, websiteRepository,
                coupleRepository, asyncEmailService);
    }

    private Guest guest(UUID coupleId, String name, String email) {
        return new Guest(
                UUID.randomUUID(), coupleId, name, email, null,
                GuestRsvpStatus.PENDING, false, null, null, null,
                null, null, null,
                null, null, null, null, null,
                null, 0,
                null, null, null, null, null, null,
                null, null, null,
                null, false);
    }

    @Test
    void sendSaveDates_stampsOnlyGuestsWithEmail_whenNoSubset() {
        UUID coupleId = UUID.randomUUID();
        Guest withEmailA = guest(coupleId, "Anna", "anna@example.com");
        Guest withEmailB = guest(coupleId, "Bo", "bo@example.com");
        Guest noEmail    = guest(coupleId, "Cy", null);

        when(guestRepository.findAllByCoupleId(coupleId))
                .thenReturn(List.of(withEmailA, withEmailB, noEmail));
        // website + couple absent: send still proceeds with default copy.
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        int sent = service().sendSaveDates(coupleId, null);

        assertThat(sent).isEqualTo(2);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<EmailRecipient>> recipients = ArgumentCaptor.forClass(List.class);
        verify(asyncEmailService).sendSaveTheDateEmails(
                recipients.capture(), anyString(), anyString(), anyString(), any());
        assertThat(recipients.getValue())
                .extracting(EmailRecipient::email)
                .containsExactlyInAnyOrder("anna@example.com", "bo@example.com");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UUID>> stamped = ArgumentCaptor.forClass(List.class);
        verify(guestRepository).markSaveTheDatesSent(stamped.capture(), any(LocalDateTime.class));
        assertThat(stamped.getValue())
                .containsExactlyInAnyOrder(withEmailA.id(), withEmailB.id());
    }

    @Test
    void sendSaveDates_respectsGuestIdSubset() {
        UUID coupleId = UUID.randomUUID();
        Guest a = guest(coupleId, "Anna", "anna@example.com");
        Guest b = guest(coupleId, "Bo", "bo@example.com");

        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(a, b));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        int sent = service().sendSaveDates(coupleId, List.of(a.id()));

        assertThat(sent).isEqualTo(1);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UUID>> stamped = ArgumentCaptor.forClass(List.class);
        verify(guestRepository).markSaveTheDatesSent(stamped.capture(), any(LocalDateTime.class));
        assertThat(stamped.getValue()).containsExactly(a.id());
    }

    @Test
    void sendSaveDates_isNoOp_whenNoEligibleGuests() {
        UUID coupleId = UUID.randomUUID();
        // No eligible recipients: the method must short-circuit before the website/couple
        // lookups, so those repositories are intentionally not stubbed here.
        when(guestRepository.findAllByCoupleId(coupleId))
                .thenReturn(List.of(guest(coupleId, "Cy", null)));

        int sent = service().sendSaveDates(coupleId, null);

        assertThat(sent).isZero();
        verify(asyncEmailService, never()).sendSaveTheDateEmails(any(), any(), any(), any(), any());
        verify(guestRepository, never()).markSaveTheDatesSent(any(), any());
    }
}
