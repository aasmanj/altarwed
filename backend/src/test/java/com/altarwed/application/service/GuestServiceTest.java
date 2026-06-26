package com.altarwed.application.service;

import com.altarwed.application.dto.SaveTheDateSendResult;
import com.altarwed.application.dto.SubmitRsvpRequest;
import com.altarwed.domain.exception.GuestUnsubscribedException;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.EmailRecipient;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.RsvpInviteToken;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.application.dto.RsvpFindResult;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.RsvpInviteTokenRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link GuestService} send paths.
 *   1-5: save-the-date batch send (eligibility, subset, stamping, no-op, invalid addresses).
 *   6:   RSVP invites honour the per-couple unsubscribe (a suppressed address is never emailed).
 */
@ExtendWith(MockitoExtension.class)
class GuestServiceTest {

    @Mock private GuestRepository guestRepository;
    @Mock private RsvpInviteTokenRepository tokenRepository;
    @Mock private WeddingWebsiteRepository websiteRepository;
    @Mock private CoupleRepository coupleRepository;
    @Mock private AsyncEmailService asyncEmailService;
    @Mock private EmailSuppressionService suppressionService;
    @Mock private CustomRsvpQuestionService customRsvpQuestionService;

    @BeforeEach
    void setUp() {
        // Sends batch the suppression lookup via reasonsByHash; default to "nothing
        // suppressed" so the happy-path send tests queue every valid guest. Lenient
        // because the invite-rejection test throws before it reaches this call.
        lenient().when(suppressionService.reasonsByHash(any(), any())).thenReturn(Map.of());
    }

    private GuestService service() {
        return new GuestService(guestRepository, tokenRepository, websiteRepository,
                coupleRepository, asyncEmailService, suppressionService, customRsvpQuestionService);
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
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, null);

        assertThat(result.queued()).isEqualTo(2);
        assertThat(result.invalidCount()).isZero();
        assertThat(result.invalidEmails()).isEmpty();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<EmailRecipient>> recipients = ArgumentCaptor.forClass(List.class);
        verify(asyncEmailService).sendSaveTheDateEmails(
                recipients.capture(), any(), anyString(), anyString(), anyString(), any(), any());
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
    void sendSaveDates_threadsCoupleEmailAsReplyTo_soGuestRepliesReachThatCouple() {
        UUID coupleId = UUID.randomUUID();
        Guest a = guest(coupleId, "Anna", "anna@example.com");
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(a));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(new com.altarwed.domain.model.Couple(
                coupleId, "Jordan", "Eden", "couple@example.com", "hash",
                null, null, null, false, true, null, null)));

        service().sendSaveDates(coupleId, null);

        // The last arg is the couple's own address; a guest hitting reply reaches them,
        // not the shared from-address.
        ArgumentCaptor<String> replyTo = ArgumentCaptor.forClass(String.class);
        verify(asyncEmailService).sendSaveTheDateEmails(
                any(), any(), anyString(), anyString(), anyString(), any(), replyTo.capture());
        assertThat(replyTo.getValue()).isEqualTo("couple@example.com");
    }

    @Test
    void sendSaveDates_respectsGuestIdSubset() {
        UUID coupleId = UUID.randomUUID();
        Guest a = guest(coupleId, "Anna", "anna@example.com");
        Guest b = guest(coupleId, "Bo", "bo@example.com");

        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(a, b));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, List.of(a.id()));

        assertThat(result.queued()).isEqualTo(1);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UUID>> stamped = ArgumentCaptor.forClass(List.class);
        verify(guestRepository).markSaveTheDatesSent(stamped.capture(), any(LocalDateTime.class));
        assertThat(stamped.getValue()).containsExactly(a.id());
    }

    @Test
    void sendSaveDates_isNoOp_whenNoEligibleGuests() {
        UUID coupleId = UUID.randomUUID();
        when(guestRepository.findAllByCoupleId(coupleId))
                .thenReturn(List.of(guest(coupleId, "Cy", null)));

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, null);

        assertThat(result.queued()).isZero();
        verify(asyncEmailService, never()).sendSaveTheDateEmails(any(), any(), any(), any(), any(), any(), any());
        verify(guestRepository, never()).markSaveTheDatesSent(any(), any());
    }

    @Test
    void sendSaveDates_reportsInvalidAddresses_andDoesNotQueueOrStampThem() {
        UUID coupleId = UUID.randomUUID();
        Guest good = guest(coupleId, "Anna", "anna@example.com");
        Guest doubleAt = guest(coupleId, "Bad Bo", "j@22@gmail.com"); // two @ signs
        Guest noDot = guest(coupleId, "Cy", "cy@localhost");          // domain has no dot

        when(guestRepository.findAllByCoupleId(coupleId))
                .thenReturn(List.of(good, doubleAt, noDot));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, null);

        assertThat(result.queued()).isEqualTo(1);
        assertThat(result.invalidCount()).isEqualTo(2);
        assertThat(result.invalidEmails())
                .extracting(SaveTheDateSendResult.InvalidGuestEmail::email)
                .containsExactlyInAnyOrder("j@22@gmail.com", "cy@localhost");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<UUID>> stamped = ArgumentCaptor.forClass(List.class);
        verify(guestRepository).markSaveTheDatesSent(stamped.capture(), any(LocalDateTime.class));
        assertThat(stamped.getValue()).containsExactly(good.id());
    }

    // ---------------------------------------------------------------------------
    // submitRsvp notifies the couple with the GUEST as Reply-To, so the couple replying
    // reaches that guest, not the shared from-address. Guards the wrong-email regression.
    // ---------------------------------------------------------------------------

    @Test
    void submitRsvp_notifiesCouple_withGuestAsReplyTo_notTheCouplesOwnEmail() {
        UUID coupleId = UUID.randomUUID();
        Guest g = guest(coupleId, "Anna", "anna@example.com");
        RsvpInviteToken token = new RsvpInviteToken(
                UUID.randomUUID(), "tokenhash", g.id(),
                LocalDateTime.now().plusDays(1), false, null, RsvpInviteToken.SOURCE_INVITE);

        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(guestRepository.findById(g.id())).thenReturn(Optional.of(g));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.of(new Couple(
                coupleId, "Jordan", "Eden", "couple@example.com", "hash",
                null, null, null, false, true, null, null)));

        service().submitRsvp(new SubmitRsvpRequest(
                "raw-token", GuestRsvpStatus.ATTENDING, null, null, null, null, null, null, null));

        // Last arg is the Reply-To: it must be the responding guest's address, NOT the
        // couple's own (which would route the couple's reply back to themselves).
        ArgumentCaptor<String> replyTo = ArgumentCaptor.forClass(String.class);
        verify(asyncEmailService).sendRsvpNotificationToCouple(
                any(), any(), any(), any(), any(), any(), replyTo.capture());
        assertThat(replyTo.getValue()).isEqualTo("anna@example.com");
    }

    // ---------------------------------------------------------------------------
    // sendInvite honours the per-couple unsubscribe: a suppressed address is never emailed.
    // ---------------------------------------------------------------------------

    @Test
    void sendInvite_throws_andNeverIssuesTokenOrEmail_whenGuestUnsubscribed() {
        UUID coupleId = UUID.randomUUID();
        Guest g = guest(coupleId, "Anna", "anna@example.com");
        when(guestRepository.findById(g.id())).thenReturn(Optional.of(g));
        when(suppressionService.isSuppressed(eq(coupleId), anyString())).thenReturn(true);

        assertThatThrownBy(() -> service().sendInvite(coupleId, g.id()))
                .isInstanceOf(GuestUnsubscribedException.class);
        // No RSVP token issued and no email queued for a suppressed address.
        verify(tokenRepository, never()).save(any());
        verify(asyncEmailService, never())
                .sendRsvpInviteEmail(any(), any(), any(), any(), any(), any(), any(), any());
    }

    // ---------------------------------------------------------------------------
    // findGuestsByName is unauthenticated, so it is hardened against token-table bloat:
    //   - a matched guest who already holds a valid search token has that one row rotated in
    //     place rather than a new row minted on every name guess (issue #31);
    //   - a query shorter than the minimum does no DB work at all.
    // ---------------------------------------------------------------------------

    @Test
    void findGuestsByName_rotatesExistingSearchTokenInPlace_soNoSecondRowIsCreated() {
        UUID coupleId = UUID.randomUUID();
        String slug = "jordan-and-eden";
        Guest g = guest(coupleId, "Jordan Aasman", null);

        WeddingWebsite website = mock(WeddingWebsite.class);
        when(website.isPublished()).thenReturn(true);
        when(website.coupleId()).thenReturn(coupleId);
        when(websiteRepository.findBySlug(slug)).thenReturn(Optional.of(website));
        when(guestRepository.findByCoupleIdAndNameContaining(coupleId, "Jordan")).thenReturn(List.of(g));

        // The first call finds no existing token (mints a new row); the second call finds the
        // token the first call persisted and must rotate it instead of inserting a new one.
        RsvpInviteToken existing = new RsvpInviteToken(
                UUID.randomUUID(), "oldhash", g.id(),
                LocalDateTime.now().plusHours(1), false, null, RsvpInviteToken.SOURCE_SEARCH);
        when(tokenRepository.findValidSearchToken(eq(g.id()), any()))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(existing));
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().findGuestsByName(slug, "Jordan");
        service().findGuestsByName(slug, "Jordan");

        ArgumentCaptor<RsvpInviteToken> saved = ArgumentCaptor.forClass(RsvpInviteToken.class);
        verify(tokenRepository, times(2)).save(saved.capture());
        List<RsvpInviteToken> tokens = saved.getAllValues();
        // First call inserts a fresh row (null id); second call reuses the existing row's id,
        // so JPA updates in place and no second token row is created.
        assertThat(tokens.get(0).id()).isNull();
        assertThat(tokens.get(0).source()).isEqualTo(RsvpInviteToken.SOURCE_SEARCH);
        assertThat(tokens.get(1).id()).isEqualTo(existing.id());
    }

    @Test
    void findGuestsByName_returnsEmptyAndWritesNothing_forSubMinimumQuery() {
        List<RsvpFindResult> result = service().findGuestsByName("jordan-and-eden", "J");

        assertThat(result).isEmpty();
        // Too-short query is rejected before any repository is touched: no token row, no lookup.
        verify(tokenRepository, never()).save(any());
        verifyNoInteractions(websiteRepository, guestRepository);
    }
}
