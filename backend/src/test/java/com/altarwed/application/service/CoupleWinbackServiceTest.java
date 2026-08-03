package com.altarwed.application.service;

import com.altarwed.domain.model.email.CoupleWinbackCandidate;
import com.altarwed.domain.model.email.CoupleWinbackTouch;
import com.altarwed.domain.port.CoupleWinbackRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link CoupleWinbackService}, the couple activation win-back sequence (issue
 * #551). The real {@link CoupleWinbackSender} is wired in so the assertions cover the whole flow
 * (outbox enqueue plus send-once marker); only the leaf port, the suppression facade, and
 * AsyncEmailService are mocked.
 *
 * Each case pins one acceptance criterion:
 *   - an unactivated couple gets the nudge for the touch they are due, and it is recorded;
 *   - each of the three touches queries its own signup window (2, 7, 21 days after signup) with
 *     the touch as the dedupe key, which is what makes the sequence send once and on time;
 *   - the enqueue commits before the marker, so a losing race rolls the queued mail back with it;
 *   - a globally unsubscribed address is skipped and NOT marked as sent;
 *   - one couple failing is a WARN and a skip, never a batch-wide abort.
 */
@ExtendWith(MockitoExtension.class)
class CoupleWinbackServiceTest {

    @BeforeAll
    static void allowLockAssertOutsideRealSchedulerLock() {
        // sendWinbackNudges() calls LockAssert.assertLocked(); these tests build the service with
        // plain `new` and no Spring AOP proxy, so there is never a real lock. Matches ShedLock's
        // documented pattern for unit-testing @SchedulerLock-annotated code.
        LockAssert.TestHelper.makeAllAssertsPass(true);
    }

    @Mock private CoupleWinbackRepository winbackRepository;
    @Mock private EmailSuppressionService suppressionService;
    @Mock private AsyncEmailService asyncEmailService;

    private CoupleWinbackService service() {
        CoupleWinbackSender sender = new CoupleWinbackSender(asyncEmailService, winbackRepository);
        return new CoupleWinbackService(winbackRepository, suppressionService, sender);
    }

    private static CoupleWinbackCandidate candidate() {
        return new CoupleWinbackCandidate(UUID.randomUUID(), "couple@example.com", "Hannah", "Micah");
    }

    /** No candidates for any touch, so a test that cares about one touch stays isolated. */
    private void noCandidatesForAnyTouch() {
        lenient().when(winbackRepository.findWinbackCandidates(
                        any(), any(), any(), any(), anyInt()))
                .thenReturn(List.of());
    }

    private void candidatesForTouch(CoupleWinbackTouch touch, CoupleWinbackCandidate... candidates) {
        lenient().when(winbackRepository.findWinbackCandidates(
                        eq(touch), any(), any(), any(), anyInt()))
                .thenReturn(List.of(candidates));
    }

    @Test
    void unactivatedCoupleIsNudgedOnceAndTheSendIsRecorded() {
        noCandidatesForAnyTouch();
        CoupleWinbackCandidate couple = candidate();
        candidatesForTouch(CoupleWinbackTouch.DAY_2, couple);
        when(suppressionService.isGloballySuppressed(anyString())).thenReturn(false);

        service().sendWinbackNudges();

        verify(asyncEmailService).sendCoupleWinbackEmail(
                "couple@example.com", "Hannah", "Micah", CoupleWinbackTouch.DAY_2);
        verify(winbackRepository).recordSent(eq(couple.coupleId()), eq(CoupleWinbackTouch.DAY_2), any());
        // Exactly one nudge: the other two touches found nobody, so nothing else was queued.
        verify(asyncEmailService, never()).sendCoupleWinbackEmail(
                anyString(), anyString(), anyString(), eq(CoupleWinbackTouch.DAY_7));
        verify(asyncEmailService, never()).sendCoupleWinbackEmail(
                anyString(), anyString(), anyString(), eq(CoupleWinbackTouch.DAY_21));
    }

    @Test
    void eachTouchQueriesItsOwnSignupWindowWithTheTouchAsTheDedupeKey() {
        noCandidatesForAnyTouch();
        LocalDateTime before = LocalDateTime.now();

        service().sendWinbackNudges();

        LocalDateTime after = LocalDateTime.now();
        ArgumentCaptor<CoupleWinbackTouch> touches = ArgumentCaptor.forClass(CoupleWinbackTouch.class);
        ArgumentCaptor<LocalDateTime> from = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> until = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDate> weddingCutoff = ArgumentCaptor.forClass(LocalDate.class);
        ArgumentCaptor<Integer> limit = ArgumentCaptor.forClass(Integer.class);
        verify(winbackRepository, times(3)).findWinbackCandidates(
                touches.capture(), from.capture(), until.capture(), weddingCutoff.capture(), limit.capture());

        // All three touches are scanned, and the touch itself is the dedupe key handed to the query
        // (the query's NOT EXISTS on couple_winback_sends is what stops a re-send).
        assertThat(touches.getAllValues()).containsExactly(
                CoupleWinbackTouch.DAY_2, CoupleWinbackTouch.DAY_7, CoupleWinbackTouch.DAY_21);

        for (int i = 0; i < 3; i++) {
            CoupleWinbackTouch touch = touches.getAllValues().get(i);
            LocalDateTime windowEnd = until.getAllValues().get(i);
            LocalDateTime windowStart = from.getAllValues().get(i);

            // A couple is due once they are at least touch.daysAfterSignup() past signup, so the
            // window's upper bound is exactly that many days before "now".
            assertThat(windowEnd).isBetween(
                    before.minusDays(touch.daysAfterSignup()),
                    after.minusDays(touch.daysAfterSignup()));

            // The window is WINDOW_WIDTH_DAYS wide so a missed run does not skip a couple entirely.
            assertThat(Duration.between(windowStart, windowEnd))
                    .isEqualTo(Duration.ofDays(CoupleWinbackService.WINDOW_WIDTH_DAYS));

            // Weddings already in the past are excluded; the cutoff is today.
            assertThat(weddingCutoff.getAllValues().get(i))
                    .isBetween(before.toLocalDate(), after.toLocalDate());
            assertThat(limit.getAllValues().get(i)).isEqualTo(CoupleWinbackService.MAX_PER_TOUCH_PER_RUN);
        }
    }

    @Test
    void queuedMailCommitsBeforeTheSendOnceMarker() {
        noCandidatesForAnyTouch();
        CoupleWinbackCandidate couple = candidate();
        candidatesForTouch(CoupleWinbackTouch.DAY_7, couple);
        when(suppressionService.isGloballySuppressed(anyString())).thenReturn(false);

        service().sendWinbackNudges();

        // Ordering is the race guard: the marker insert goes last inside the shared transaction, so
        // a unique-constraint violation from a concurrent run rolls the queued nudge back with it
        // instead of leaving a second email in the outbox.
        InOrder ordered = inOrder(asyncEmailService, winbackRepository);
        ordered.verify(asyncEmailService).sendCoupleWinbackEmail(
                anyString(), anyString(), anyString(), eq(CoupleWinbackTouch.DAY_7));
        ordered.verify(winbackRepository).recordSent(
                eq(couple.coupleId()), eq(CoupleWinbackTouch.DAY_7), any());
    }

    @Test
    void globallyUnsubscribedCoupleIsSkippedAndNotMarkedAsSent() {
        noCandidatesForAnyTouch();
        CoupleWinbackCandidate couple = candidate();
        candidatesForTouch(CoupleWinbackTouch.DAY_2, couple);
        when(suppressionService.isGloballySuppressed(anyString())).thenReturn(true);

        service().sendWinbackNudges();

        verifyNoInteractions(asyncEmailService);
        // No marker either: recording a send that never happened would be a lie in the ledger.
        verify(winbackRepository, never()).recordSent(any(), any(), any());
    }

    @Test
    void candidateWithNoAddressIsSkippedWithoutConsultingSuppression() {
        noCandidatesForAnyTouch();
        candidatesForTouch(CoupleWinbackTouch.DAY_21,
                new CoupleWinbackCandidate(UUID.randomUUID(), "  ", "Hannah", "Micah"));

        service().sendWinbackNudges();

        verifyNoInteractions(asyncEmailService);
        verify(winbackRepository, never()).recordSent(any(), any(), any());
        verify(suppressionService, never()).isGloballySuppressed(anyString());
    }

    @Test
    void oneFailingCoupleDoesNotAbortTheRestOfTheBatch() {
        noCandidatesForAnyTouch();
        CoupleWinbackCandidate doomed = candidate();
        CoupleWinbackCandidate healthy = candidate();
        candidatesForTouch(CoupleWinbackTouch.DAY_2, doomed, healthy);
        when(suppressionService.isGloballySuppressed(anyString())).thenReturn(false);
        // Simulates the losing side of a duplicate-marker race (or any per-couple write failure).
        doThrow(new IllegalStateException("duplicate marker"))
                .when(winbackRepository).recordSent(eq(doomed.coupleId()), any(), any());

        service().sendWinbackNudges();

        // The second couple still gets their nudge and their marker.
        verify(winbackRepository).recordSent(eq(healthy.coupleId()), eq(CoupleWinbackTouch.DAY_2), any());
    }
}
