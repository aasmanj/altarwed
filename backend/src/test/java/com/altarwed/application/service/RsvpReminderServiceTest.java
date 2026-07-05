package com.altarwed.application.service;

import com.altarwed.domain.exception.GuestUnsubscribedException;
import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.port.GuestRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link RsvpReminderService}, the hourly RSVP reminder batch.
 *   1: a single guest that throws (here, unsubscribed) must not abort the batch; every other
 *      due guest is still sent, and the job itself never throws.
 *   2: the method must NOT carry a method-level @Transactional, so each per-guest sendInvite
 *      commits as its own unit of work and one rollback-only failure cannot undo the rest.
 */
@ExtendWith(MockitoExtension.class)
class RsvpReminderServiceTest {

    @BeforeAll
    static void allowLockAssertOutsideRealSchedulerLock() {
        // sendDueReminders() calls LockAssert.assertLocked() (issue #44); these tests build the
        // service with plain `new` and no Spring AOP proxy, so there is never a real lock. This
        // tells LockAssert to pass anyway on this thread, matching ShedLock's documented pattern
        // for unit-testing @SchedulerLock-annotated code.
        LockAssert.TestHelper.makeAllAssertsPass(true);
    }

    @Mock private GuestRepository guestRepository;
    @Mock private GuestService guestService;

    private RsvpReminderService service() {
        return new RsvpReminderService(guestRepository, guestService);
    }

    private Guest dueGuest(UUID coupleId) {
        return new Guest(
                UUID.randomUUID(), coupleId, "Guest", "guest@example.com", null,
                GuestRsvpStatus.PENDING, false, null, null, null,
                null, null, null,
                null, null, null, null, null,
                null, 0,
                null, null, null,
                LocalDateTime.now().minusMinutes(5), // remindAt due
                null, null,
                null, null, null,
                null, false);
    }

    @Test
    void sendDueReminders_continuesBatch_whenOneGuestThrows() {
        UUID coupleId = UUID.randomUUID();
        Guest first = dueGuest(coupleId);
        Guest unsubscribed = dueGuest(coupleId);
        Guest last = dueGuest(coupleId);

        when(guestRepository.findDueReminders(any(), anyInt()))
                .thenReturn(List.of(first, unsubscribed, last));
        // The middle guest unsubscribed: its sendReminderInvite throws. Before this fix the
        // shared transaction would be marked rollback-only and the whole batch would die at
        // commit. sendReminderInvite is void, so stub the throw with doThrow.
        doThrow(new GuestUnsubscribedException("unsubscribed"))
                .when(guestService).sendReminderInvite(eq(coupleId), eq(unsubscribed.id()));

        // The job swallows the per-guest failure and never propagates it.
        assertThatCode(() -> service().sendDueReminders()).doesNotThrowAnyException();

        // Every due guest is still attempted; the throwing one does not short-circuit the rest.
        verify(guestService).sendReminderInvite(coupleId, first.id());
        verify(guestService).sendReminderInvite(coupleId, unsubscribed.id());
        verify(guestService).sendReminderInvite(coupleId, last.id());
        verify(guestService, times(3)).sendReminderInvite(eq(coupleId), any());
    }

    @Test
    void sendDueReminders_queriesWithTheInviteCap_soAtCapGuestsAreNeverFetched() {
        // Issue #233: the due-reminder query must exclude guests already at the invite-send cap
        // (the belt to sendReminderInvite's suspenders). Assert the scheduler passes the cap
        // through so an at-cap guest is filtered out in SQL, not re-fetched and rejected hourly.
        when(guestRepository.findDueReminders(any(), anyInt())).thenReturn(List.of());

        service().sendDueReminders();

        verify(guestRepository).findDueReminders(any(), eq(GuestService.MAX_INVITE_SENDS));
    }

    @Test
    void sendDueReminders_isNotMethodLevelTransactional_soEachGuestIsItsOwnUnitOfWork() throws Exception {
        Method method = RsvpReminderService.class.getMethod("sendDueReminders");
        // A method-level @Transactional would re-introduce the shared rollback-only failure mode
        // that this fix removes; each per-guest sendInvite carries its own @Transactional instead.
        assertThat(method.isAnnotationPresent(
                org.springframework.transaction.annotation.Transactional.class)).isFalse();
        // A class-level @Transactional would also wrap the method in one shared transaction and
        // bring the bug back while the method-level check above stayed green, so guard it too.
        assertThat(RsvpReminderService.class.getAnnotation(
                org.springframework.transaction.annotation.Transactional.class)).isNull();
    }
}
