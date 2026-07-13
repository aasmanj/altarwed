package com.altarwed.application.service;

import com.altarwed.application.dto.CreateGuestRequest;
import com.altarwed.application.dto.SaveTheDateSendResult;
import com.altarwed.application.dto.SubmitRsvpRequest;
import com.altarwed.domain.exception.GuestUnsubscribedException;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.EmailRecipient;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.RsvpInviteBulkSend;
import com.altarwed.domain.model.RsvpInviteRecipient;
import com.altarwed.domain.model.RsvpInviteToken;
import com.altarwed.domain.model.SaveTheDateSend;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.application.dto.RsvpFindResult;
import com.altarwed.application.dto.PartyMemberInfo;
import com.altarwed.application.dto.RsvpPageDataResponse;
import com.altarwed.domain.exception.CaptchaVerificationFailedException;
import com.altarwed.domain.exception.RsvpSearchThrottledException;
import com.altarwed.domain.port.CaptchaVerificationPort;
import com.altarwed.domain.port.RsvpSearchThrottlePort;
import com.altarwed.infrastructure.security.InMemoryRsvpSearchThrottleAdapter;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.RsvpInviteTokenRepository;
import com.altarwed.domain.port.RsvpInviteBulkSendRepository;
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
    @Mock private RsvpInviteBulkSendRepository rsvpInviteBulkSendRepository;

    // Real in-memory throttle, not a mock: it is a pure value object with no external deps, so
    // exercising the concrete Bucket4j-backed adapter tests the actual anti-enumeration behavior
    // (issue #89) end to end through the service rather than asserting against a scripted mock.
    // Fresh per test method (JUnit default per-method lifecycle) via setUp, so state never leaks.
    private RsvpSearchThrottlePort searchThrottle;

    @BeforeEach
    void setUp() {
        searchThrottle = new InMemoryRsvpSearchThrottleAdapter();
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
                captchaVerificationPort, saveTheDateSendRepository, rsvpInviteBulkSendRepository,
                searchThrottle);
    }

    // Typed captor for the batched RSVP invite recipient list. The unchecked cast is unavoidable
    // when capturing a generic List with Mockito's Class-based forClass; isolated here so the
    // suppression does not spread across the individual tests.
    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<List<RsvpInviteRecipient>> batchCaptor() {
        return ArgumentCaptor.forClass(List.class);
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
        // One batched Resend call carries only the two eligible guests; the over-cap guest's
        // address is never queued (issue #378, invite-all now fans out through /emails/batch).
        ArgumentCaptor<List<RsvpInviteRecipient>> batch = batchCaptor();
        verify(asyncEmailService).sendRsvpInviteEmails(batch.capture(), any(), any(), any(), any());
        assertThat(batch.getValue()).extracting(RsvpInviteRecipient::email)
                .containsExactlyInAnyOrder("anna@example.com", "cy@example.com")
                .doesNotContain("bo@example.com");
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

        var result = service().sendInvitesBulk(coupleId, List.of(a.id(), b.id()), null);

        assertThat(result.sent()).isEqualTo(2);
        assertThat(result.skipped()).isZero();
        assertThat(result.skippedGuests()).isEmpty();
        verify(tokenRepository, times(2)).save(any());
        // Both eligible guests ride ONE batched Resend call, not two single sends (issue #378).
        ArgumentCaptor<List<RsvpInviteRecipient>> batch = batchCaptor();
        verify(asyncEmailService).sendRsvpInviteEmails(batch.capture(), any(), any(), any(), any());
        assertThat(batch.getValue()).extracting(RsvpInviteRecipient::email)
                .containsExactlyInAnyOrder("anna@example.com", "bo@example.com");
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

        var result = service().sendInvitesBulk(coupleId, List.of(good.id(), noEmail.id()), null);

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.skipped()).isEqualTo(1);
        assertThat(result.skippedGuests())
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.guestId()).isEqualTo(noEmail.id());
                    assertThat(s.reason()).isEqualTo("no_email");
                });
        // The no-email guest never gets a token or a place in the batched send.
        ArgumentCaptor<List<RsvpInviteRecipient>> batch = batchCaptor();
        verify(asyncEmailService).sendRsvpInviteEmails(batch.capture(), any(), any(), any(), any());
        assertThat(batch.getValue()).extracting(RsvpInviteRecipient::email)
                .containsExactly("anna@example.com");
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

        var result = service().sendInvitesBulk(coupleId, List.of(pending.id(), responded.id()), null);

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.skippedGuests())
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.guestId()).isEqualTo(responded.id());
                    assertThat(s.reason()).isEqualTo("already_responded");
                });
        // The skipped guest is never placed in the batched send; only the eligible guest is.
        ArgumentCaptor<List<RsvpInviteRecipient>> batch = batchCaptor();
        verify(asyncEmailService).sendRsvpInviteEmails(batch.capture(), any(), any(), any(), any());
        assertThat(batch.getValue()).extracting(RsvpInviteRecipient::email)
                .containsExactly("anna@example.com")
                .doesNotContain("bo@example.com");
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

        var result = service().sendInvitesBulk(coupleId, List.of(eligible.id(), overCap.id()), null);

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.skippedGuests())
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.guestId()).isEqualTo(overCap.id());
                    assertThat(s.reason()).isEqualTo("cap_reached");
                });
        // The skipped guest is never placed in the batched send; only the eligible guest is.
        ArgumentCaptor<List<RsvpInviteRecipient>> batch = batchCaptor();
        verify(asyncEmailService).sendRsvpInviteEmails(batch.capture(), any(), any(), any(), any());
        assertThat(batch.getValue()).extracting(RsvpInviteRecipient::email)
                .containsExactly("anna@example.com")
                .doesNotContain("bo@example.com");
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

        var result = service().sendInvitesBulk(coupleId, List.of(eligible.id(), unsub.id()), null);

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.skippedGuests())
                .singleElement()
                .satisfies(s -> {
                    assertThat(s.guestId()).isEqualTo(unsub.id());
                    assertThat(s.reason()).isEqualTo("unsubscribed");
                });
        // The skipped guest is never placed in the batched send; only the eligible guest is.
        ArgumentCaptor<List<RsvpInviteRecipient>> batch = batchCaptor();
        verify(asyncEmailService).sendRsvpInviteEmails(batch.capture(), any(), any(), any(), any());
        assertThat(batch.getValue()).extracting(RsvpInviteRecipient::email)
                .containsExactly("anna@example.com")
                .doesNotContain("bo@example.com");
    }

    @Test
    void sendInvitesBulk_rejectsWholeRequestWith403_whenAnyIdIsAnotherCouplesGuest() {
        UUID coupleId = UUID.randomUUID();
        Guest mine = guest(coupleId, "Anna", "anna@example.com");
        UUID foreignGuestId = UUID.randomUUID(); // not in this couple's list

        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(mine));

        assertThatThrownBy(() ->
                service().sendInvitesBulk(coupleId, List.of(mine.id(), foreignGuestId), null))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);

        // Nothing is partially processed: not even the caller's own valid guest is invited.
        verify(tokenRepository, never()).save(any());
        verify(guestRepository, never()).save(any());
        verify(asyncEmailService, never())
                .sendRsvpInviteEmails(any(), any(), any(), any(), any());
    }

    // ---------------------------------------------------------------------------
    // Bulk invite idempotency (issue #295). Same contract as sendSaveDates (#232):
    // a retry carrying the same client key replays the stored summary instead of
    // re-emailing; a concurrent duplicate loses the unique-index race and replays
    // the winner; a keyless request behaves exactly as before.
    // ---------------------------------------------------------------------------

    @Test
    void sendInvitesBulk_replaysStoredSummary_withoutSending_whenKeyAlreadyRecorded() {
        UUID coupleId = UUID.randomUUID();
        when(rsvpInviteBulkSendRepository.findByCoupleIdAndIdempotencyKey(coupleId, "key-1"))
                .thenReturn(Optional.of(new RsvpInviteBulkSend(
                        UUID.randomUUID(), coupleId, "key-1", 40, 2, LocalDateTime.now())));

        var result = service().sendInvitesBulk(coupleId, List.of(UUID.randomUUID()), "key-1");

        assertThat(result.sent()).isEqualTo(40);
        assertThat(result.skipped()).isEqualTo(2);
        assertThat(result.replayed()).isTrue();
        // The replay short-circuits before any guest work: no reads, no tokens, no emails.
        verifyNoInteractions(guestRepository, tokenRepository, asyncEmailService);
    }

    @Test
    void sendInvitesBulk_claimsKeyBeforeFanout_thenSendsOnce() {
        UUID coupleId = UUID.randomUUID();
        Guest a = guest(coupleId, "Anna", "anna@example.com");
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(a));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(rsvpInviteBulkSendRepository.findByCoupleIdAndIdempotencyKey(coupleId, "key-2"))
                .thenReturn(Optional.empty());
        when(rsvpInviteBulkSendRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service().sendInvitesBulk(coupleId, List.of(a.id()), "key-2");

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.replayed()).isFalse();
        // The receipt is claimed with the computed summary counts before the fan-out.
        ArgumentCaptor<RsvpInviteBulkSend> receipt = ArgumentCaptor.forClass(RsvpInviteBulkSend.class);
        verify(rsvpInviteBulkSendRepository).save(receipt.capture());
        assertThat(receipt.getValue().idempotencyKey()).isEqualTo("key-2");
        assertThat(receipt.getValue().sentCount()).isEqualTo(1);
        assertThat(receipt.getValue().skippedCount()).isZero();
        // The single eligible guest is dispatched via one batched Resend call (issue #378).
        verify(asyncEmailService, times(1))
                .sendRsvpInviteEmails(any(), any(), any(), any(), any());
    }

    @Test
    void sendInvitesBulk_racingDuplicateKey_replaysWinner_withoutSending() {
        UUID coupleId = UUID.randomUUID();
        Guest a = guest(coupleId, "Anna", "anna@example.com");
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(a));
        // First check sees no receipt (the race window), the claim insert loses the unique
        // index, and the post-race lookup returns the winner's receipt.
        when(rsvpInviteBulkSendRepository.findByCoupleIdAndIdempotencyKey(coupleId, "key-3"))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(new RsvpInviteBulkSend(
                        UUID.randomUUID(), coupleId, "key-3", 1, 0, LocalDateTime.now())));
        when(rsvpInviteBulkSendRepository.save(any()))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("dup key"));

        var result = service().sendInvitesBulk(coupleId, List.of(a.id()), "key-3");

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.replayed()).isTrue();
        // The loser never mails the batch.
        verify(tokenRepository, never()).save(any());
        verify(asyncEmailService, never())
                .sendRsvpInviteEmails(any(), any(), any(), any(), any());
    }

    @Test
    void sendInvitesBulk_withoutKey_neverTouchesReceiptMachinery() {
        UUID coupleId = UUID.randomUUID();
        Guest a = guest(coupleId, "Anna", "anna@example.com");
        when(guestRepository.findAllByCoupleId(coupleId)).thenReturn(List.of(a));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service().sendInvitesBulk(coupleId, List.of(a.id()), null);

        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.replayed()).isFalse();
        verifyNoInteractions(rsvpInviteBulkSendRepository);
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
    // Issue #89: PII redaction on a SEARCH-sourced RSVP view. A token minted from a bare name
    // search carries no possession factor, so the RSVP page must not disclose the private
    // noteForCouple or other party members' dietary/song. A token from the emailed invite (the
    // email on file IS the possession factor) keeps full disclosure, unchanged.
    // ---------------------------------------------------------------------------

    // A guest in a party, with private fields populated, for the disclosure tests.
    private Guest partyGuest(UUID coupleId, UUID partyId, String name,
                             String dietary, String song, String note) {
        return new Guest(
                UUID.randomUUID(), coupleId, name, name.toLowerCase() + "@example.com", null,
                GuestRsvpStatus.ATTENDING, false, null, dietary, song,
                null, null, null,
                null, null, null, null, null,
                note, 0,
                null, null, null, null, null, null,
                partyId, "The " + name + " Party", false,
                null, false);
    }

    private RsvpPageDataResponse rsvpViewForTokenSource(String source) {
        UUID coupleId = UUID.randomUUID();
        UUID partyId = UUID.randomUUID();
        Guest holder = partyGuest(coupleId, partyId, "Jordan",
                "no shellfish", "Canon in D", "please seat us near the front");
        Guest otherMember = partyGuest(coupleId, partyId, "Eden",
                "vegetarian", "Ode to Joy", "the private note of another member");

        RsvpInviteToken token = new RsvpInviteToken(
                UUID.randomUUID(), "tokenhash", holder.id(),
                LocalDateTime.now().plusHours(1), false, null, source);

        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(guestRepository.findById(holder.id())).thenReturn(Optional.of(holder));
        when(guestRepository.findAllByPartyId(partyId)).thenReturn(List.of(holder, otherMember));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        return service().getRsvpPageData("raw-token");
    }

    @Test
    void getRsvpPageData_redactsPrivateFields_forSearchSourcedToken() {
        RsvpPageDataResponse view = rsvpViewForTokenSource(RsvpInviteToken.SOURCE_SEARCH);

        // The private note left for the couple is never disclosed to a bare name match.
        assertThat(view.currentNoteForCouple()).isNull();

        // The token holder's own dietary/song stay so their own form pre-fills.
        assertThat(view.currentDietary()).isEqualTo("no shellfish");
        assertThat(view.currentSongRequest()).isEqualTo("Canon in D");

        // Other party members keep name + rsvpStatus (household toggles still render) but their
        // private dietary/song are nulled.
        assertThat(view.partyMembers()).hasSize(1);
        PartyMemberInfo other = view.partyMembers().get(0);
        assertThat(other.name()).isEqualTo("Eden");
        assertThat(other.currentRsvpStatus()).isEqualTo("ATTENDING");
        assertThat(other.currentDietary()).isNull();
        assertThat(other.currentSongRequest()).isNull();
    }

    @Test
    void getRsvpPageData_fullDisclosure_forInviteSourcedToken() {
        RsvpPageDataResponse view = rsvpViewForTokenSource(RsvpInviteToken.SOURCE_INVITE);

        // Emailed-link (possession factor) view is unchanged: everything is populated.
        assertThat(view.currentNoteForCouple()).isEqualTo("please seat us near the front");
        assertThat(view.currentDietary()).isEqualTo("no shellfish");
        assertThat(view.currentSongRequest()).isEqualTo("Canon in D");

        assertThat(view.partyMembers()).hasSize(1);
        PartyMemberInfo other = view.partyMembers().get(0);
        assertThat(other.name()).isEqualTo("Eden");
        assertThat(other.currentRsvpStatus()).isEqualTo("ATTENDING");
        assertThat(other.currentDietary()).isEqualTo("vegetarian");
        assertThat(other.currentSongRequest()).isEqualTo("Ode to Joy");
    }

    @Test
    void getRsvpPageData_fullDisclosure_forLegacyNullSourceToken() {
        // Edge branch: a legacy token predating the source discriminator has source == null. It is
        // NOT redacted, because any null-source token that still resolves is a long-lived INVITE
        // token (search tokens expire in one hour and resolveToken rejects expired ones), so
        // redacting on null would silently gut a real emailed link. Treated exactly like INVITE.
        RsvpPageDataResponse view = rsvpViewForTokenSource(null);

        assertThat(view.currentNoteForCouple()).isEqualTo("please seat us near the front");
        assertThat(view.currentDietary()).isEqualTo("no shellfish");
        assertThat(view.currentSongRequest()).isEqualTo("Canon in D");

        assertThat(view.partyMembers()).hasSize(1);
        PartyMemberInfo other = view.partyMembers().get(0);
        assertThat(other.currentDietary()).isEqualTo("vegetarian");
        assertThat(other.currentSongRequest()).isEqualTo("Ode to Joy");
    }

    @Test
    void getRsvpPageData_searchView_soloGuest_noNpe_andNullsNote() {
        // Edge branch: a SEARCH view on a guest with partyId == null must not NPE on the party
        // block (partyMembers stays null, partyName stays null) and still redacts the private note.
        UUID coupleId = UUID.randomUUID();
        Guest solo = new Guest(
                UUID.randomUUID(), coupleId, "Jordan", "jordan@example.com", null,
                GuestRsvpStatus.ATTENDING, false, null, "no shellfish", "Canon in D",
                null, null, null,
                null, null, null, null, null,
                "please seat us near the front", 0,
                null, null, null, null, null, null,
                null, null, false,   // partyId == null: solo guest
                null, false);

        RsvpInviteToken token = new RsvpInviteToken(
                UUID.randomUUID(), "tokenhash", solo.id(),
                LocalDateTime.now().plusHours(1), false, null, RsvpInviteToken.SOURCE_SEARCH);

        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(guestRepository.findById(solo.id())).thenReturn(Optional.of(solo));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.empty());
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        RsvpPageDataResponse view = service().getRsvpPageData("raw-token");

        assertThat(view.partyMembers()).isNull();
        assertThat(view.partyName()).isNull();
        // Private note redacted on the SEARCH view; the holder's own dietary/song still pre-fill.
        assertThat(view.currentNoteForCouple()).isNull();
        assertThat(view.currentDietary()).isEqualTo("no shellfish");
        assertThat(view.currentSongRequest()).isEqualTo("Canon in D");
        // findAllByPartyId must never be called for a solo guest.
        verify(guestRepository, never()).findAllByPartyId(any());
    }

    // ---------------------------------------------------------------------------
    // Issue #89 (H1/H2): per-wedding anti-enumeration lockout. EVERY find attempt is charged
    // against the wedding's budget (hit or miss) with no reset-on-success, so a harvester walking
    // name substrings (each hit returning up to five masked names + live tokens) is bounded, not
    // exempt. The budget keys on the canonical coupleId, so recased/whitespace slug variants for
    // the same wedding share one bucket instead of each getting a fresh budget (H2). Throttling is
    // per wedding, not per source IP (the per-IP filter is XFF-bypassable, #41).
    // ---------------------------------------------------------------------------

    // Mirrors InMemoryRsvpSearchThrottleAdapter.SEARCH_BUDGET (package-private, not visible from
    // this test's package). Kept in sync deliberately: if the adapter's budget changes, this test's
    // exact-count assertions should be revisited with it.
    private static final int SEARCH_BUDGET = 20;

    @Test
    void findGuestsByName_locksOutWedding_afterBudgetOfFailedSearches() {
        String slug = "jordan-and-eden";
        UUID coupleId = UUID.randomUUID();
        WeddingWebsite website = mock(WeddingWebsite.class);
        when(website.isPublished()).thenReturn(true);
        when(website.coupleId()).thenReturn(coupleId);
        when(websiteRepository.findBySlug(slug)).thenReturn(Optional.of(website));
        // Every search is a miss (zero results): still charged against the wedding's budget.
        when(guestRepository.findByCoupleIdAndNameContaining(eq(coupleId), anyString()))
                .thenReturn(List.of());

        // Drive searches until the wedding locks out. It must lock exactly after the adapter's
        // SEARCH_BUDGET attempts are spent; earlier searches return empty without throwing.
        int succeededBeforeLock = 0;
        boolean lockedOut = false;
        GuestService svc = service();
        for (int i = 0; i < SEARCH_BUDGET * 3; i++) {
            try {
                List<RsvpFindResult> r = svc.findGuestsByName(slug, "Ghost", "captcha", "203.0.113." + i);
                assertThat(r).isEmpty();
                succeededBeforeLock++;
            } catch (RsvpSearchThrottledException e) {
                lockedOut = true;
                break;
            }
        }

        assertThat(lockedOut).isTrue();
        assertThat(succeededBeforeLock).isEqualTo(SEARCH_BUDGET);
    }

    @Test
    void findGuestsByName_successfulSearchesAlsoConsumeBudget_andEventuallyLockOut() {
        // H1 regression: a successful substring match is the harvest path (returns up to five masked
        // names + live RSVP tokens), so it MUST consume budget and MUST NOT reset it. After
        // SEARCH_BUDGET successful searches the wedding locks out just as a run of misses would.
        String slug = "jordan-and-eden";
        UUID coupleId = UUID.randomUUID();
        Guest match = guest(coupleId, "Jordan Aasman", null);
        WeddingWebsite website = mock(WeddingWebsite.class);
        when(website.isPublished()).thenReturn(true);
        when(website.coupleId()).thenReturn(coupleId);
        when(websiteRepository.findBySlug(slug)).thenReturn(Optional.of(website));
        when(guestRepository.findByCoupleIdAndNameContaining(eq(coupleId), anyString()))
                .thenReturn(List.of(match));
        when(tokenRepository.findValidSearchToken(any(), any())).thenReturn(Optional.empty());
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        GuestService svc = service();
        int matchedBeforeLock = 0;
        boolean lockedOut = false;
        for (int i = 0; i < SEARCH_BUDGET * 3; i++) {
            try {
                assertThat(svc.findGuestsByName(slug, "Jordan", "captcha", "203.0.113." + i)).hasSize(1);
                matchedBeforeLock++;
            } catch (RsvpSearchThrottledException e) {
                lockedOut = true;
                break;
            }
        }

        assertThat(lockedOut).as("harvest path must be throttled, not exempt").isTrue();
        assertThat(matchedBeforeLock).isEqualTo(SEARCH_BUDGET);
    }

    @Test
    void findGuestsByName_caseAndWhitespaceSlugVariants_shareOneWeddingBudget() {
        // H2 regression: findBySlug resolves under case-insensitive collation, so these three slug
        // strings are the SAME wedding. The throttle keys on the resolved coupleId, so the variants
        // draw down ONE shared budget; an attacker cannot multiply the harvest ceiling by recasing
        // or padding the slug. Simulate the collation by mapping every variant to the same website.
        UUID coupleId = UUID.randomUUID();
        WeddingWebsite website = mock(WeddingWebsite.class);
        when(website.isPublished()).thenReturn(true);
        when(website.coupleId()).thenReturn(coupleId);
        String[] variants = {"Jordan-Eden", "jordan-eden", " jordan-eden"};
        for (String v : variants) {
            when(websiteRepository.findBySlug(v)).thenReturn(Optional.of(website));
        }
        when(guestRepository.findByCoupleIdAndNameContaining(eq(coupleId), anyString()))
                .thenReturn(List.of());

        GuestService svc = service();
        // Spend the whole budget across a mix of the three variants (round-robin).
        for (int i = 0; i < SEARCH_BUDGET; i++) {
            String v = variants[i % variants.length];
            assertThat(svc.findGuestsByName(v, "Ghost", "captcha", "203.0.113." + i)).isEmpty();
        }
        // A different-cased variant is now locked out too: the budget was shared, not per-slug.
        // (All three variants resolve to the same wedding, so any of them hits the same drained bucket.)
        assertThatThrownBy(() -> svc.findGuestsByName("Jordan-Eden", "Ghost", "captcha", "203.0.113.250"))
                .isInstanceOf(RsvpSearchThrottledException.class);
    }

    // ---------------------------------------------------------------------------
    // Reminder-path cap handling (issue #233). The couple-initiated sendInvite throws at the
    // cap so the couple sees the rejection and remind_at is left untouched; the reminder-driven
    // sendReminderInvite instead clears remind_at (no send, no throw) so an at-cap guest drops
    // out of findDueReminders for good rather than being retried and WARN-logged every hour.
    // ---------------------------------------------------------------------------

    private Guest guestWithReminder(UUID coupleId, int inviteSendCount, LocalDateTime remindAt) {
        return new Guest(
                UUID.randomUUID(), coupleId, "Guest", "guest@example.com", null,
                GuestRsvpStatus.PENDING, false, null, null, null,
                null, null, null,
                null, null, null, null, null,
                null, inviteSendCount,
                null, null, null, remindAt,
                null, null,
                null, null, null,
                null, false);
    }

    @Test
    void sendReminderInvite_clearsRemindAt_andNeitherSendsNorThrows_whenGuestAtCap() {
        UUID coupleId = UUID.randomUUID();
        LocalDateTime remindAt = LocalDateTime.now().minusMinutes(5);
        Guest atCap = guestWithReminder(coupleId, 3, remindAt); // at MAX_INVITE_SENDS = 3
        when(guestRepository.findById(atCap.id())).thenReturn(Optional.of(atCap));
        when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThatCode(() -> service().sendReminderInvite(coupleId, atCap.id()))
                .doesNotThrowAnyException();

        // remind_at is cleared so the guest can never re-qualify for a reminder, while
        // invite_send_count is left untouched (no phantom send).
        ArgumentCaptor<Guest> saved = ArgumentCaptor.forClass(Guest.class);
        verify(guestRepository).save(saved.capture());
        assertThat(saved.getValue().remindAt()).isNull();
        assertThat(saved.getValue().inviteSendCount()).isEqualTo(3);

        // No new token, no invite email: the cap means nothing is actually sent.
        verify(tokenRepository, never()).save(any());
        verify(asyncEmailService, never()).sendRsvpInviteEmail(
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void sendInvite_throwsAtCap_andDoesNotClearRemindAtOrPersistAnything() {
        UUID coupleId = UUID.randomUUID();
        LocalDateTime remindAt = LocalDateTime.now().minusMinutes(5);
        Guest atCap = guestWithReminder(coupleId, 3, remindAt); // at MAX_INVITE_SENDS = 3
        when(guestRepository.findById(atCap.id())).thenReturn(Optional.of(atCap));

        // The couple-initiated path must still reject an over-cap send with an error, so the
        // dashboard surfaces it. Crucially it must NOT clear remind_at (that reminder-path
        // behaviour must not leak into the couple path).
        assertThatThrownBy(() -> service().sendInvite(coupleId, atCap.id()))
                .isInstanceOf(IllegalArgumentException.class);

        verify(guestRepository, never()).save(any());
        verify(tokenRepository, never()).save(any());
        verify(asyncEmailService, never()).sendRsvpInviteEmail(
                any(), any(), any(), any(), any(), any(), any(), any());
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

    // addGuestsBulk: verifies that the three new optional fields (plusOneName, rsvpStatus,
    // tableNumber) added to CreateGuestRequest (#264) are mapped into the persisted Guest
    // record, not silently dropped as they were before the fix.

    private CreateGuestRequest bulkReq(String name, String plusOneName,
                                       GuestRsvpStatus rsvpStatus, Integer tableNumber) {
        return new CreateGuestRequest(
                name, null, null, true,
                plusOneName, rsvpStatus, tableNumber,
                null, null, null,
                null, null, null, null, null,
                null, null, null);
    }

    @Test
    void addGuestsBulk_persistsPlusOneName_rsvpStatus_andTableNumber_whenProvided() {
        UUID coupleId = UUID.randomUUID();
        when(guestRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        List<Guest> saved = service().addGuestsBulk(coupleId,
                List.of(bulkReq("Alice Smith", "Bob Smith", GuestRsvpStatus.ATTENDING, 5)));

        assertThat(saved).hasSize(1);
        Guest g = saved.get(0);
        assertThat(g.plusOneName()).isEqualTo("Bob Smith");
        assertThat(g.rsvpStatus()).isEqualTo(GuestRsvpStatus.ATTENDING);
        assertThat(g.tableNumber()).isEqualTo(5);
    }

    @Test
    void addGuestsBulk_defaultsRsvpStatusToPending_whenNotProvided() {
        UUID coupleId = UUID.randomUUID();
        when(guestRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        List<Guest> saved = service().addGuestsBulk(coupleId,
                List.of(bulkReq("Carol Jones", null, null, null)));

        assertThat(saved.get(0).rsvpStatus()).isEqualTo(GuestRsvpStatus.PENDING);
    }

    @Test
    void addGuestsBulk_collapsesBlankPlusOneName_toNull() {
        UUID coupleId = UUID.randomUUID();
        when(guestRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        List<Guest> saved = service().addGuestsBulk(coupleId,
                List.of(bulkReq("Dave Lee", "   ", null, null)));

        assertThat(saved.get(0).plusOneName()).isNull();
    }

    // ---------------------------------------------------------------------------
    // Issue #330: the RSVP page payload additionally carries the raw ISO wedding date,
    // the free-form ceremony time, and the full venue street address, so the public
    // confirmation screen can build an "add to calendar" .ics client-side. The existing
    // formatted display string and city/state fields are unchanged.
    // ---------------------------------------------------------------------------

    @Test
    void getRsvpPageData_exposesRawIsoDate_ceremonyTime_andVenueAddress_forCalendarDownload() {
        UUID coupleId = UUID.randomUUID();
        Guest g = guest(coupleId, "Anna", "anna@example.com");
        RsvpInviteToken token = new RsvpInviteToken(
                UUID.randomUUID(), "tokenhash", g.id(),
                LocalDateTime.now().plusDays(1), false, null, RsvpInviteToken.SOURCE_INVITE);

        WeddingWebsite website = mock(WeddingWebsite.class);
        when(website.weddingDate()).thenReturn(LocalDate.of(2026, 6, 20));
        when(website.ceremonyTime()).thenReturn("4:00 PM");
        when(website.venueAddress()).thenReturn("123 Chapel Lane");
        lenient().when(website.venueName()).thenReturn("Grace Chapel");

        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(guestRepository.findById(g.id())).thenReturn(Optional.of(g));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.of(website));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        var response = service().getRsvpPageData("raw-token");

        // Raw ISO date is LocalDate.toString() (yyyy-MM-dd), distinct from the localized display
        // string, so the client can build the .ics DTSTART without re-parsing "MMMM d, yyyy".
        assertThat(response.weddingDateIso()).isEqualTo("2026-06-20");
        assertThat(response.weddingDate()).isEqualTo("June 20, 2026");
        // Ceremony time is passed through verbatim; parsing/fallback is the client's concern.
        assertThat(response.ceremonyTime()).isEqualTo("4:00 PM");
        // Full street address now rides on the payload for the calendar LOCATION field.
        assertThat(response.venueAddress()).isEqualTo("123 Chapel Lane");
    }

    @Test
    void getRsvpPageData_nullsCalendarFields_whenWeddingHasNoDateOrTime() {
        UUID coupleId = UUID.randomUUID();
        Guest g = guest(coupleId, "Anna", "anna@example.com");
        RsvpInviteToken token = new RsvpInviteToken(
                UUID.randomUUID(), "tokenhash", g.id(),
                LocalDateTime.now().plusDays(1), false, null, RsvpInviteToken.SOURCE_INVITE);

        WeddingWebsite website = mock(WeddingWebsite.class);
        // weddingDate/ceremonyTime/venueAddress all unset (mock returns null) -> the client
        // hides the button (no date) and there is no crash building the payload.

        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(guestRepository.findById(g.id())).thenReturn(Optional.of(g));
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.of(website));
        when(coupleRepository.findById(coupleId)).thenReturn(Optional.empty());

        var response = service().getRsvpPageData("raw-token");

        assertThat(response.weddingDateIso()).isNull();
        assertThat(response.ceremonyTime()).isNull();
        assertThat(response.venueAddress()).isNull();
    }
}
