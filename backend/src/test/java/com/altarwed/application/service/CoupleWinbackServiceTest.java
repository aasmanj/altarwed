package com.altarwed.application.service;

import com.altarwed.domain.model.AcquisitionSource;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.CoupleWinbackTouchRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link CoupleWinbackService}, the hourly couple win-back sequence (issue #551).
 * The real {@link CoupleWinbackSender} is wired in so the assertions cover the whole flow (ledger
 * record + outbox enqueue); only the leaf repositories, suppression service, and AsyncEmailService
 * are mocked. Each case pins one behaviour from the acceptance criteria:
 *   - a couple ~2 / ~7 / ~21 days out with no published site is nudged with the right touch;
 *   - a couple who already published is skipped;
 *   - a couple too recent to be in any window is skipped;
 *   - a couple whose touch is already recorded is skipped (no double-send);
 *   - an unsubscribed / suppressed couple is skipped;
 *   - a losing race on the unique constraint (record throws) never aborts the batch or double-sends;
 *   - the touch-selection math is exact at the window boundaries;
 *   - the candidate query reads only the win-back age window.
 */
@ExtendWith(MockitoExtension.class)
class CoupleWinbackServiceTest {

    @BeforeAll
    static void allowLockAssertOutsideRealSchedulerLock() {
        // sendWinbackTouches() calls LockAssert.assertLocked() (issue #44); these tests build the
        // service with plain `new` and no Spring AOP proxy, so there is never a real lock. Matches
        // ShedLock's documented pattern for unit-testing @SchedulerLock-annotated code.
        LockAssert.TestHelper.makeAllAssertsPass(true);
    }

    @Mock private CoupleRepository coupleRepository;
    @Mock private WeddingWebsiteRepository websiteRepository;
    @Mock private CoupleWinbackTouchRepository touchRepository;
    @Mock private EmailSuppressionService suppressionService;
    @Mock private AsyncEmailService asyncEmailService;

    private CoupleWinbackService service() {
        CoupleWinbackSender sender = new CoupleWinbackSender(asyncEmailService, touchRepository);
        return new CoupleWinbackService(coupleRepository, websiteRepository, touchRepository,
                suppressionService, sender);
    }

    // --- touch selection: eligible ------------------------------------------------------------

    @Test
    void sendsDay2Touch_forSignupTwoDaysOldWithNoPublishedSite() {
        Couple couple = coupleAgedDays(2);
        when(coupleRepository.findActiveCreatedBetween(any(), any())).thenReturn(List.of(couple));
        when(websiteRepository.findByCoupleId(couple.id())).thenReturn(Optional.empty());
        when(suppressionService.isSuppressed(eq(couple.id()), anyString())).thenReturn(false);
        when(touchRepository.findSentTouches(couple.id())).thenReturn(Set.of());

        service().sendWinbackTouches();

        // Recorded in the ledger AND enqueued, both for the DAY_2 touch.
        verify(touchRepository).recordSent(eq(couple.id()), eq(CoupleWinbackTouch.DAY_2), any());
        verify(asyncEmailService).sendCoupleWinbackEmail(
                eq("couple@example.com"), eq("Eden"), eq("Jordan"), eq(CoupleWinbackTouch.DAY_2));
    }

    @Test
    void sendsDay7Touch_forSignupSevenDaysOld() {
        Couple couple = coupleAgedDays(7);
        when(coupleRepository.findActiveCreatedBetween(any(), any())).thenReturn(List.of(couple));
        when(websiteRepository.findByCoupleId(couple.id())).thenReturn(Optional.empty());
        when(suppressionService.isSuppressed(eq(couple.id()), anyString())).thenReturn(false);
        when(touchRepository.findSentTouches(couple.id())).thenReturn(Set.of());

        service().sendWinbackTouches();

        verify(asyncEmailService).sendCoupleWinbackEmail(any(), any(), any(), eq(CoupleWinbackTouch.DAY_7));
    }

    @Test
    void sendsDay21Touch_forSignupTwentyOneDaysOld() {
        Couple couple = coupleAgedDays(21);
        when(coupleRepository.findActiveCreatedBetween(any(), any())).thenReturn(List.of(couple));
        when(websiteRepository.findByCoupleId(couple.id())).thenReturn(Optional.empty());
        when(suppressionService.isSuppressed(eq(couple.id()), anyString())).thenReturn(false);
        when(touchRepository.findSentTouches(couple.id())).thenReturn(Set.of());

        service().sendWinbackTouches();

        verify(asyncEmailService).sendCoupleWinbackEmail(any(), any(), any(), eq(CoupleWinbackTouch.DAY_21));
    }

    // --- touch selection: ineligible ----------------------------------------------------------

    @Test
    void skipsCoupleWithPublishedWebsite() {
        Couple couple = coupleAgedDays(2);
        when(coupleRepository.findActiveCreatedBetween(any(), any())).thenReturn(List.of(couple));
        when(websiteRepository.findByCoupleId(couple.id()))
                .thenReturn(Optional.of(publishedWebsite(couple.id())));

        service().sendWinbackTouches();

        verify(asyncEmailService, never()).sendCoupleWinbackEmail(any(), any(), any(), any());
        verify(touchRepository, never()).recordSent(any(), any(), any());
    }

    @Test
    void skipsCoupleTooRecentForAnyTouch() {
        // One day old: below the earliest window. In production the query would not even return it;
        // this proves the service's own age guard rejects it (never sends between windows).
        Couple couple = coupleAgedDays(1);
        when(coupleRepository.findActiveCreatedBetween(any(), any())).thenReturn(List.of(couple));

        service().sendWinbackTouches();

        verify(asyncEmailService, never()).sendCoupleWinbackEmail(any(), any(), any(), any());
    }

    @Test
    void skipsCoupleInGapBetweenWindows() {
        // Twelve days old: past the day-7 window, not yet in the day-21 window. No touch is due.
        Couple couple = coupleAgedDays(12);
        when(coupleRepository.findActiveCreatedBetween(any(), any())).thenReturn(List.of(couple));

        service().sendWinbackTouches();

        verify(asyncEmailService, never()).sendCoupleWinbackEmail(any(), any(), any(), any());
    }

    @Test
    void skipsCoupleWhoseTouchWasAlreadySent() {
        Couple couple = coupleAgedDays(2);
        when(coupleRepository.findActiveCreatedBetween(any(), any())).thenReturn(List.of(couple));
        when(websiteRepository.findByCoupleId(couple.id())).thenReturn(Optional.empty());
        when(suppressionService.isSuppressed(eq(couple.id()), anyString())).thenReturn(false);
        // Ledger already holds the DAY_2 touch: it must not be sent again.
        when(touchRepository.findSentTouches(couple.id())).thenReturn(Set.of(CoupleWinbackTouch.DAY_2));

        service().sendWinbackTouches();

        verify(asyncEmailService, never()).sendCoupleWinbackEmail(any(), any(), any(), any());
        verify(touchRepository, never()).recordSent(any(), any(), any());
    }

    @Test
    void skipsUnsubscribedOrSuppressedCouple() {
        Couple couple = coupleAgedDays(2);
        when(coupleRepository.findActiveCreatedBetween(any(), any())).thenReturn(List.of(couple));
        when(websiteRepository.findByCoupleId(couple.id())).thenReturn(Optional.empty());
        when(suppressionService.isSuppressed(eq(couple.id()), anyString())).thenReturn(true);

        service().sendWinbackTouches();

        verify(asyncEmailService, never()).sendCoupleWinbackEmail(any(), any(), any(), any());
        verify(touchRepository, never()).recordSent(any(), any(), any());
    }

    // --- dedupe under retry / race ------------------------------------------------------------

    @Test
    void losingTheUniqueConstraintRace_neverAbortsBatch_norDoubleSends() {
        Couple racer = coupleAgedDays(2, "racer@example.com");   // ledger insert loses the race, throws
        Couple healthy = coupleAgedDays(2, "healthy@example.com"); // must still be sent
        when(coupleRepository.findActiveCreatedBetween(any(), any()))
                .thenReturn(List.of(racer, healthy));
        lenient().when(websiteRepository.findByCoupleId(any())).thenReturn(Optional.empty());
        lenient().when(suppressionService.isSuppressed(any(), anyString())).thenReturn(false);
        lenient().when(touchRepository.findSentTouches(any())).thenReturn(Set.of());
        // The unique (couple_id, touch) constraint rejects the racer's insert. recordSent runs
        // before the enqueue, so the enqueue for the racer never happens.
        doThrow(new DataIntegrityViolationException("uq_couple_winback_touch"))
                .when(touchRepository).recordSent(eq(racer.id()), any(), any());

        assertThatCode(() -> service().sendWinbackTouches()).doesNotThrowAnyException();

        // The racer never gets an email (its transaction rolled back); the healthy couple still does.
        verify(asyncEmailService, never())
                .sendCoupleWinbackEmail(eq("racer@example.com"), any(), any(), any());
        verify(asyncEmailService)
                .sendCoupleWinbackEmail(eq("healthy@example.com"), any(), any(), eq(CoupleWinbackTouch.DAY_2));
    }

    // --- scheduling math (copy-free) ----------------------------------------------------------

    @Test
    void touchForAge_isExactAtWindowBoundaries() {
        assertThat(CoupleWinbackService.touchForAge(1)).isEmpty();
        assertThat(CoupleWinbackService.touchForAge(2)).contains(CoupleWinbackTouch.DAY_2);
        assertThat(CoupleWinbackService.touchForAge(4)).contains(CoupleWinbackTouch.DAY_2);
        assertThat(CoupleWinbackService.touchForAge(5)).isEmpty();
        assertThat(CoupleWinbackService.touchForAge(7)).contains(CoupleWinbackTouch.DAY_7);
        assertThat(CoupleWinbackService.touchForAge(9)).contains(CoupleWinbackTouch.DAY_7);
        assertThat(CoupleWinbackService.touchForAge(20)).isEmpty();
        assertThat(CoupleWinbackService.touchForAge(21)).contains(CoupleWinbackTouch.DAY_21);
        assertThat(CoupleWinbackService.touchForAge(23)).contains(CoupleWinbackTouch.DAY_21);
        // Past the final window the sequence ends: no infinite nagging.
        assertThat(CoupleWinbackService.touchForAge(24)).isEmpty();
        assertThat(CoupleWinbackService.touchForAge(60)).isEmpty();
    }

    @Test
    void candidateQuery_readsOnlyTheWinbackAgeWindow() {
        when(coupleRepository.findActiveCreatedBetween(any(), any())).thenReturn(List.of());

        service().sendWinbackTouches();

        ArgumentCaptor<LocalDateTime> from = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> to = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(coupleRepository).findActiveCreatedBetween(from.capture(), to.capture());
        // The window spans exactly (latest - earliest) days, and its young edge is at least the
        // earliest age back from now, so no couple younger than the first touch is ever fetched.
        // Compared in UTC: the service pins its clock to UTC to match couples.created_at
        // (GETUTCDATE()), so the bound must use the same zone or this fails on any non-UTC machine.
        assertThat(ChronoUnit.DAYS.between(from.getValue(), to.getValue()))
                .isEqualTo(CoupleWinbackService.LATEST_AGE_DAYS - CoupleWinbackService.EARLIEST_AGE_DAYS);
        assertThat(to.getValue()).isBeforeOrEqualTo(
                LocalDateTime.now(ZoneOffset.UTC).minusDays(CoupleWinbackService.EARLIEST_AGE_DAYS));
    }

    // --- structural guard ---------------------------------------------------------------------

    @Test
    void sendWinbackTouches_isNotMethodLevelTransactional_soEachCoupleIsItsOwnUnitOfWork() throws Exception {
        Method method = CoupleWinbackService.class.getMethod("sendWinbackTouches");
        // A method- or class-level @Transactional would wrap the whole batch in one unit of work, so
        // a single couple's rollback-only failure (a lost constraint race) would undo every other
        // couple's ledger insert. Each per-couple send must stay its own transaction in the sender.
        assertThat(method.isAnnotationPresent(
                org.springframework.transaction.annotation.Transactional.class)).isFalse();
        assertThat(CoupleWinbackService.class.getAnnotation(
                org.springframework.transaction.annotation.Transactional.class)).isNull();
    }

    // --- fixtures -----------------------------------------------------------------------------

    private static Couple coupleAgedDays(int ageDays) {
        return coupleAgedDays(ageDays, "couple@example.com");
    }

    private static Couple coupleAgedDays(int ageDays, String email) {
        return new Couple(
                UUID.randomUUID(), "Eden", "Jordan", email, "hash",
                null, null, AcquisitionSource.empty(), false, true,
                LocalDateTime.now().minusDays(ageDays), LocalDateTime.now().minusDays(ageDays));
    }

    // Minimal published website: only isPublished (4th arg) is read by the win-back flow.
    private static WeddingWebsite publishedWebsite(UUID coupleId) {
        return new WeddingWebsite(
                UUID.randomUUID(), coupleId, "eden-and-jordan", true,
                "Eden", "Jordan", null, null,
                null, null, null, null, null,
                null, null, null, null,
                null, null, null, null, null, null,
                null, null,
                null, null, null,
                null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                null,
                null, null, null, null, null, null, null, null,
                null, null,
                null, null,
                false, null,
                null, null);
    }
}
