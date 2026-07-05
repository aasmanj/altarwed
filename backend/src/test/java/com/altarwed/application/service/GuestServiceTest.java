package com.altarwed.application.service;

import com.altarwed.application.dto.SaveTheDateSendResult;
import com.altarwed.application.dto.SubmitRsvpRequest;
import com.altarwed.domain.exception.GuestUnsubscribedException;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.EmailRecipient;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.RsvpInviteToken;
import com.altarwed.domain.model.SaveTheDateSend;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.application.dto.RsvpFindResult;
import com.altarwed.domain.exception.CaptchaVerificationFailedException;
import com.altarwed.domain.port.CaptchaVerificationPort;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.RsvpInviteTokenRepository;
import com.altarwed.domain.port.SaveTheDateSendRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
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
    @Mock private CaptchaVerificationPort captchaVerificationPort;
    @Mock private SaveTheDateSendRepository saveTheDateSendRepository;

    @BeforeEach
    void setUp() {
        // Sends batch the suppression lookup via reasonsByHash; default to "nothing
        // suppressed" so the happy-path send tests queue every valid guest. Lenient
        // because the invite-rejection test throws before it reaches this call.
        lenient().when(suppressionService.reasonsByHash(any(), any())).thenReturn(Map.of());
        // Default every test to a "human verified" captcha result; the one test that
        // cares about captcha rejection overrides this explicitly. Lenient because most
        // tests here (send paths) never call findGuestsByName at all.
        lenient().when(captchaVerificationPort.verify(any(), any())).thenReturn(true);
    }

    private GuestService service() {
        return new GuestService(guestRepository, tokenRepository, websiteRepository,
                coupleRepository, asyncEmailService, suppressionService, customRsvpQuestionService,
                captchaVerificationPort, saveTheDateSendRepository);
    }

    private Guest guest(UUID coupleId, String name, String email) {
        return guest(coupleId, name, email, 0);
    }

    private Guest guest(UUID coupleId, String name, String email, int inviteSendCount) {
        return new Guest(
                UUID.randomUUID(), coupleId, name, email, null,
                GuestRsvpStatus.PENDING, false, null, null, null,
                null, null, null,
                null, null, null, null, null,
                null, inviteSendCount,
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

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, null, null);

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

        service().sendSaveDates(coupleId, null, null);

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

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, List.of(a.id()), null);

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

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, null, null);

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

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, null, null);

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
    // Idempotency (issue #232): a retry carrying the same client key must not re-email or
    // re-stamp. The first send claims the key; a replay of that key returns the stored
    // summary and touches nothing. A concurrent duplicate (both submits pass the initial
    // "no receipt yet" check) is serialised by the unique index: the loser's save throws
    // and it replays the winner rather than sending a second batch.
    // ---------------------------------------------------------------------------

    @Test
    void sendSaveDates_replaysStoredSummary_whenKeyAlreadyRecorded_withoutEmailingOrStamping() {
        UUID coupleId = UUID.randomUUID();
        // A receipt for this exact key already exists (the first send succeeded server-side; its
        // HTTP response was lost and the couple retried).
        when(saveTheDateSendRepository.findByCoupleIdAndIdempotencyKey(coupleId, "attempt-1"))
                .thenReturn(Optional.of(new SaveTheDateSend(
                        UUID.randomUUID(), coupleId, "attempt-1", 3, 1, 2, LocalDateTime.now())));

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, null, "attempt-1");

        // Summary is the original send's, flagged as a replay.
        assertThat(result.replayed()).isTrue();
        assertThat(result.queued()).isEqualTo(3);
        assertThat(result.invalidCount()).isEqualTo(1);
        assertThat(result.suppressedCount()).isEqualTo(2);

        // The batch is never re-sent, never re-stamped, and no second receipt is written. The
        // replay short-circuits before we even load the guest list.
        verify(asyncEmailService, never()).sendSaveTheDateEmails(any(), any(), any(), any(), any(), any(), any());
        verify(guestRepository, never()).markSaveTheDatesSent(any(), any());
        verify(guestRepository, never()).findAllByCoupleId(any());
        verify(saveTheDateSendRepository, never()).save(any());
    }

    @Test
    void sendSaveDates_firstSendWithKey_recordsReceiptThenEmailsAndStamps() {
        UUID coupleId = UUID.randomUUID();
        Guest a = guest(coupleId, "Anna", "anna@example.com");
        when(saveTheDateSendRepository.findByCoupleIdAndIdempotencyKey(coupleId, "attempt-1"))
                .thenReturn(Optional.empty());
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(a));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, null, "attempt-1");

        assertThat(result.replayed()).isFalse();
        assertThat(result.queued()).isEqualTo(1);
        // The key is claimed with the send's actual counts before the batch goes out.
        ArgumentCaptor<SaveTheDateSend> receipt = ArgumentCaptor.forClass(SaveTheDateSend.class);
        verify(saveTheDateSendRepository).save(receipt.capture());
        assertThat(receipt.getValue().idempotencyKey()).isEqualTo("attempt-1");
        assertThat(receipt.getValue().queuedCount()).isEqualTo(1);
        verify(asyncEmailService).sendSaveTheDateEmails(any(), any(), anyString(), anyString(), anyString(), any(), any());
        verify(guestRepository).markSaveTheDatesSent(any(), any(LocalDateTime.class));
    }

    @Test
    void sendSaveDates_concurrentDuplicateKey_sendsOnce_loserReplaysWinner() {
        UUID coupleId = UUID.randomUUID();
        Guest a = guest(coupleId, "Anna", "anna@example.com");
        // Both concurrent submits saw no receipt on their initial check.
        when(saveTheDateSendRepository.findByCoupleIdAndIdempotencyKey(coupleId, "attempt-1"))
                .thenReturn(Optional.empty())                       // pre-claim replay check
                .thenReturn(Optional.of(new SaveTheDateSend(        // post-collision winner lookup
                        UUID.randomUUID(), coupleId, "attempt-1", 5, 0, 0, LocalDateTime.now())));
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(a));
        // The claim (and its collision) happens before the send block loads the website/couple,
        // so those repositories are never reached on the loser path.
        // This request is the loser: the winner already claimed the key, so the unique index
        // rejects this insert.
        when(saveTheDateSendRepository.save(any()))
                .thenThrow(new DataIntegrityViolationException("duplicate (couple_id, idempotency_key)"));

        SaveTheDateSendResult result = service().sendSaveDates(coupleId, null, "attempt-1");

        // The loser replays the winner's summary and, crucially, never emails or stamps: the
        // batch is mailed exactly once across the two concurrent requests.
        assertThat(result.replayed()).isTrue();
        assertThat(result.queued()).isEqualTo(5);
        verify(asyncEmailService, never()).sendSaveTheDateEmails(any(), any(), any(), any(), any(), any(), any());
        verify(guestRepository, never()).markSaveTheDatesSent(any(), any());
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

        service().findGuestsByName(slug, "Jordan", "captcha-token", "203.0.113.1");
        service().findGuestsByName(slug, "Jordan", "captcha-token", "203.0.113.1");

        ArgumentCaptor<RsvpInviteToken> saved = ArgumentCaptor.forClass(RsvpInviteToken.class);
        verify(tokenRepository, times(2)).save(saved.capture());
        List<RsvpInviteToken> tokens = saved.getAllValues();
        // First call inserts a fresh row (null id); second call reuses the existing row's id,
        // so JPA updates in place and no second token row is created.
        assertThat(tokens.get(0).id()).isNull();
        assertThat(tokens.get(0).source()).isEqualTo(RsvpInviteToken.SOURCE_SEARCH);
        assertThat(tokens.get(1).id()).isEqualTo(existing.id());
    }

    // ---------------------------------------------------------------------------
    // sendAllPendingInvites is resilient to an over-cap guest: it skips the guest already at
    // MAX_INVITE_SENDS instead of letting issueInvite throw mid-loop and roll back the whole
    // @Transactional batch (which previously returned 500 and re-sent everyone on retry).
    // ---------------------------------------------------------------------------

    @Test
    void sendAllPendingInvites_skipsOverCapGuest_andStillInvitesEligibleOnes() {
        UUID coupleId = UUID.randomUUID();
        Guest eligibleA = guest(coupleId, "Anna", "anna@example.com", 1);
        Guest overCap   = guest(coupleId, "Bo", "bo@example.com", 3); // at MAX_INVITE_SENDS = 3
        Guest eligibleB = guest(coupleId, "Cy", "cy@example.com", 0);

        when(guestRepository.findAllByCoupleId(coupleId))
                .thenReturn(List.of(eligibleA, overCap, eligibleB));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int invited = service().sendAllPendingInvites(coupleId);

        // Two eligible guests invited, over-cap guest skipped, and the batch never throws.
        assertThat(invited).isEqualTo(2);

        ArgumentCaptor<Guest> saved = ArgumentCaptor.forClass(Guest.class);
        verify(guestRepository, times(2)).save(saved.capture());
        assertThat(saved.getAllValues())
                .extracting(Guest::id)
                .containsExactlyInAnyOrder(eligibleA.id(), eligibleB.id())
                .doesNotContain(overCap.id());

        // Each eligible guest got a fresh invite token persisted; the over-cap guest did not.
        verify(tokenRepository, times(2)).save(any());
        // No invite email queued for the over-cap guest's address.
        verify(asyncEmailService, never()).sendRsvpInviteEmail(
                eq("bo@example.com"), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void sendAllPendingInvites_doesNotThrow_whenEveryGuestIsOverCap() {
        UUID coupleId = UUID.randomUUID();
        Guest overCapA = guest(coupleId, "Anna", "anna@example.com", 3);
        Guest overCapB = guest(coupleId, "Bo", "bo@example.com", 4);

        when(guestRepository.findAllByCoupleId(coupleId))
                .thenReturn(List.of(overCapA, overCapB));

        assertThatCode(() -> {
            int invited = service().sendAllPendingInvites(coupleId);
            assertThat(invited).isZero();
        }).doesNotThrowAnyException();

        verify(guestRepository, never()).save(any());
        verify(tokenRepository, never()).save(any());
    }

    // ---------------------------------------------------------------------------
    // sendInvitesBulk: explicit selected-id bulk invite. Applies the three skip rules
    // (no email / already responded / cap reached) plus the unsubscribe opt-out, reports
    // them instead of throwing, and rejects the whole request (403) if any id is foreign.
    // ---------------------------------------------------------------------------

    private Guest respondedGuest(UUID coupleId, String name, String email) {
        return new Guest(
                UUID.randomUUID(), coupleId, name, email, null,
                GuestRsvpStatus.ATTENDING, false, null, null, null,
                null, null, null,
                null, null, null, null, null,
                null, 0,
                null, null, LocalDateTime.now(), null, null, null,
                null, null, null,
                null, false);
    }

    @Test
    void sendInvitesBulk_invitesEligibleGuests_andReturnsSentCount() {
        UUID coupleId = UUID.randomUUID();
        Guest a = guest(coupleId, "Anna", "anna@example.com");
        Guest b = guest(coupleId, "Bo", "bo@example.com");

        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(a, b));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service().sendInvitesBulk(coupleId, List.of(a.id(), b.id()));

        assertThat(result.sent()).isEqualTo(2);
        assertThat(result.skipped()).isZero();
        assertThat(result.skippedGuests()).isEmpty();
        verify(tokenRepository, times(2)).save(any());
        verify(asyncEmailService, times(2))
                .sendRsvpInviteEmail(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void sendInvitesBulk_skipsGuestWithNoEmail_withReason() {
        UUID coupleId = UUID.randomUUID();
        Guest good = guest(coupleId, "Anna", "anna@example.com");
        Guest noEmail = guest(coupleId, "Cy", null);

        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(good, noEmail));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service().sendInvitesBulk(coupleId, List.of(good.id(), noEmail.id()));

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.skipped()).isEqualTo(1);
        assertThat(result.skippedGuests())
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.guestId()).isEqualTo(noEmail.id());
                    assertThat(s.reason()).isEqualTo("no_email");
                });
        // The no-email guest never gets a token or an email.
        verify(asyncEmailService, never())
                .sendRsvpInviteEmail(eq(null), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void sendInvitesBulk_skipsAlreadyRespondedGuest_withReason() {
        UUID coupleId = UUID.randomUUID();
        Guest pending = guest(coupleId, "Anna", "anna@example.com");
        Guest responded = respondedGuest(coupleId, "Bo", "bo@example.com");

        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(pending, responded));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service().sendInvitesBulk(coupleId, List.of(pending.id(), responded.id()));

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.skippedGuests())
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.guestId()).isEqualTo(responded.id());
                    assertThat(s.reason()).isEqualTo("already_responded");
                });
        verify(asyncEmailService, never()).sendRsvpInviteEmail(
                eq("bo@example.com"), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void sendInvitesBulk_skipsOverCapGuest_withReason() {
        UUID coupleId = UUID.randomUUID();
        Guest eligible = guest(coupleId, "Anna", "anna@example.com", 0);
        Guest overCap = guest(coupleId, "Bo", "bo@example.com", 3); // at MAX_INVITE_SENDS = 3

        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(eligible, overCap));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service().sendInvitesBulk(coupleId, List.of(eligible.id(), overCap.id()));

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.skippedGuests())
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.guestId()).isEqualTo(overCap.id());
                    assertThat(s.reason()).isEqualTo("cap_reached");
                });
        verify(asyncEmailService, never()).sendRsvpInviteEmail(
                eq("bo@example.com"), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void sendInvitesBulk_skipsUnsubscribedGuest_withReason() {
        UUID coupleId = UUID.randomUUID();
        Guest eligible = guest(coupleId, "Anna", "anna@example.com");
        Guest unsub = guest(coupleId, "Bo", "bo@example.com");

        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(eligible, unsub));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // Only Bo's address is suppressed for this couple.
        String boHash = EmailSuppressionService.emailHash("bo@example.com");
        when(suppressionService.reasonsByHash(eq(coupleId), any()))
                .thenReturn(Map.of(boHash, "USER_REQUEST"));

        var result = service().sendInvitesBulk(coupleId, List.of(eligible.id(), unsub.id()));

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.skippedGuests())
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.guestId()).isEqualTo(unsub.id());
                    assertThat(s.reason()).isEqualTo("unsubscribed");
                });
        verify(asyncEmailService, never()).sendRsvpInviteEmail(
                eq("bo@example.com"), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void sendInvitesBulk_rejectsWholeRequestWith403_whenAnyIdIsAnotherCouplesGuest() {
        UUID coupleId = UUID.randomUUID();
        Guest mine = guest(coupleId, "Anna", "anna@example.com");
        UUID foreignGuestId = UUID.randomUUID(); // not in this couple's list

        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(mine));

        assertThatThrownBy(() ->
                service().sendInvitesBulk(coupleId, List.of(mine.id(), foreignGuestId)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);

        // Nothing is partially processed: not even the caller's own valid guest is invited.
        verify(tokenRepository, never()).save(any());
        verify(guestRepository, never()).save(any());
        verify(asyncEmailService, never())
                .sendRsvpInviteEmail(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void findGuestsByName_returnsEmptyAndWritesNothing_forSubMinimumQuery() {
        // "Jor" (3 chars) is below MIN_SEARCH_QUERY_LENGTH (4, raised from 2 by issue #89
        // to stop short, high-yield guesses like "Jo" from enumerating real guests).
        List<RsvpFindResult> result = service().findGuestsByName(
                "jordan-and-eden", "Jor", "captcha-token", "203.0.113.1");

        assertThat(result).isEmpty();
        // Too-short query is rejected before any repository OR the captcha provider is
        // touched: no token row, no lookup, no wasted call to Cloudflare.
        verify(tokenRepository, never()).save(any());
        verifyNoInteractions(websiteRepository, guestRepository, captchaVerificationPort);
    }

    @Test
    void findGuestsByName_rejectsAFailedCaptcha_beforeAnyDbWork() {
        when(captchaVerificationPort.verify("bad-token", "203.0.113.1")).thenReturn(false);

        // Issue #89: a captcha failure must reject the whole search, not just log it, so an
        // automated caller supplying no/invalid token never reaches the guest repository.
        assertThatThrownBy(() ->
                service().findGuestsByName("jordan-and-eden", "Jordan", "bad-token", "203.0.113.1"))
                .isInstanceOf(CaptchaVerificationFailedException.class);

        verifyNoInteractions(websiteRepository, guestRepository, tokenRepository);
    }

    // ---------------------------------------------------------------------------
    // Issue #216: RSVP invite tokens expire relative to the wedding date, not a fixed 30 days
    // after send, so a guest who clicks the emailed link in the final weeks before the wedding
    // no longer hits a dead "This link has expired" screen.
    //   - wedding date set:  expires at end of (weddingDate + 3 days);
    //   - no wedding date:   expires now + 365 days;
    //   - wedding tomorrow:  the 30-day floor keeps the link usable despite a very near date.
    // computeInviteExpiry is a pure function, so the branch logic is asserted directly, then one
    // wiring test proves sendInvite actually feeds the couple's wedding date into it.
    // ---------------------------------------------------------------------------

    @Test
    void computeInviteExpiry_weddingEightWeeksOut_staysValidThroughWeddingWeekend() {
        LocalDateTime now = LocalDateTime.of(2026, 1, 1, 9, 0);
        LocalDate weddingDate = now.toLocalDate().plusWeeks(8); // 2026-02-26

        LocalDateTime expiry = GuestService.computeInviteExpiry(weddingDate, now);

        // Expires at the very end of (wedding date + 3 days), well past the wedding weekend and
        // far beyond the old now+30 window (which would have died on 2026-01-31).
        assertThat(expiry).isEqualTo(weddingDate.plusDays(3).atTime(LocalTime.MAX));
        assertThat(expiry.toLocalDate()).isAfter(weddingDate);
        assertThat(expiry).isAfter(now.plusDays(30));
    }

    @Test
    void computeInviteExpiry_noWeddingDate_fallsBackToOneYear() {
        LocalDateTime now = LocalDateTime.of(2026, 1, 1, 9, 0);

        LocalDateTime expiry = GuestService.computeInviteExpiry(null, now);

        assertThat(expiry).isEqualTo(now.plusDays(365));
    }

    @Test
    void computeInviteExpiry_weddingTomorrow_appliesThirtyDayFloor() {
        LocalDateTime now = LocalDateTime.of(2026, 1, 1, 9, 0);
        LocalDate weddingDate = now.toLocalDate().plusDays(1); // wedding is tomorrow

        LocalDateTime expiry = GuestService.computeInviteExpiry(weddingDate, now);

        // Wedding + 3 days would expire in ~4 days, below the floor, so the floor (now + 30 days)
        // wins and the link stays usable for a couple who sent invites at the last minute.
        assertThat(expiry).isEqualTo(now.plusDays(30));
        assertThat(expiry).isAfter(weddingDate.plusDays(3).atTime(LocalTime.MAX));
    }

    @Test
    void sendInvite_setsTokenExpiryFromWeddingDate_notFixedThirtyDays() {
        UUID coupleId = UUID.randomUUID();
        Guest g = guest(coupleId, "Anna", "anna@example.com");
        LocalDate weddingDate = LocalDate.now().plusWeeks(8);

        WeddingWebsite website = mock(WeddingWebsite.class);
        when(website.weddingDate()).thenReturn(weddingDate);

        when(guestRepository.findById(g.id())).thenReturn(Optional.of(g));
        when(suppressionService.isSuppressed(eq(coupleId), anyString())).thenReturn(false);
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.of(website));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service().sendInvite(coupleId, g.id());

        ArgumentCaptor<RsvpInviteToken> saved = ArgumentCaptor.forClass(RsvpInviteToken.class);
        verify(tokenRepository).save(saved.capture());
        // The persisted token expires from the wedding date, not now+30, so a late click still works.
        assertThat(saved.getValue().expiresAt())
                .isEqualTo(weddingDate.plusDays(3).atTime(LocalTime.MAX));
    }
}
