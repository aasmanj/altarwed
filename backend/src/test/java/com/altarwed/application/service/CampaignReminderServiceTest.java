package com.altarwed.application.service;

import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.GuestRsvpStatus;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.RsvpInviteTokenRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link CampaignReminderService}, the hourly date-offset RSVP campaign reminders
 * (issue #458). The real {@link CampaignReminderSender} is wired in so the assertions cover the
 * whole flow (enqueue + sent-marker stamp); only the leaf repositories and AsyncEmailService are
 * mocked. Every case pins one behaviour from the acceptance criteria:
 *   - a PENDING guest ~30 days out is nudged and stamped;
 *   - a guest already stamped is skipped (no double-send);
 *   - a wedding with no date is skipped;
 *   - a wedding with an incomplete venue is skipped;
 *   - an ATTENDING guest ~7 days out gets venue details and is stamped.
 */
@ExtendWith(MockitoExtension.class)
class CampaignReminderServiceTest {

    @BeforeAll
    static void allowLockAssertOutsideRealSchedulerLock() {
        // sendCampaignReminders() calls LockAssert.assertLocked(); these tests build the service
        // with plain `new` and no Spring AOP proxy, so there is never a real lock. Matches
        // ShedLock's documented pattern for unit-testing @SchedulerLock-annotated code.
        LockAssert.TestHelper.makeAllAssertsPass(true);
    }

    @Mock private WeddingWebsiteRepository websiteRepository;
    @Mock private GuestRepository guestRepository;
    @Mock private EmailSuppressionService suppressionService;
    @Mock private AsyncEmailService asyncEmailService;
    @Mock private RsvpInviteTokenRepository tokenRepository;

    private CampaignReminderService service() {
        CampaignReminderSender sender =
                new CampaignReminderSender(asyncEmailService, guestRepository, tokenRepository);
        return new CampaignReminderService(websiteRepository, guestRepository, suppressionService, sender);
    }

    private final LocalDate today = LocalDate.now();

    @Test
    void nonresponderReminder_sentAndStamped_forPendingGuestThirtyDaysOut() {
        UUID coupleId = UUID.randomUUID();
        WeddingWebsite wedding = wedding(coupleId, today.plusDays(30), "100 Chapel Rd", "Austin");
        Guest pending = guest(coupleId, GuestRsvpStatus.PENDING, null, null);

        lenient().when(websiteRepository.findByWeddingDateBetween(eq(today.plusDays(29)), eq(today.plusDays(31))))
                .thenReturn(List.of(wedding));
        when(guestRepository.findNonresponderReminderTargets(coupleId)).thenReturn(List.of(pending));

        service().sendCampaignReminders();

        // Reminder enqueued with the guest's live details and a freshly minted RSVP token.
        verify(asyncEmailService).sendNonresponderReminderEmail(
                eq("guest@example.com"), eq("Guest"), anyString(), anyString(),
                eq("100 Chapel Rd"), eq("Austin"), anyString(), anyString(),
                anyString(), anyString());
        verify(tokenRepository).save(any());

        // The sent-marker is stamped in the same unit so the guest is never nudged twice.
        ArgumentCaptor<Guest> saved = ArgumentCaptor.forClass(Guest.class);
        verify(guestRepository).save(saved.capture());
        assertThat(saved.getValue().nonresponderReminderSentAt()).isNotNull();
    }

    @Test
    void nonresponderReminder_notResent_whenMarkerAlreadySet() {
        UUID coupleId = UUID.randomUUID();
        WeddingWebsite wedding = wedding(coupleId, today.plusDays(30), "100 Chapel Rd", "Austin");
        // A guest that already carries the marker (e.g. a stale read): the defensive guard must skip it.
        Guest alreadySent = guest(coupleId, GuestRsvpStatus.PENDING, OffsetDateTime.now(), null);

        lenient().when(websiteRepository.findByWeddingDateBetween(eq(today.plusDays(29)), eq(today.plusDays(31))))
                .thenReturn(List.of(wedding));
        when(guestRepository.findNonresponderReminderTargets(coupleId)).thenReturn(List.of(alreadySent));

        service().sendCampaignReminders();

        verify(asyncEmailService, never()).sendNonresponderReminderEmail(
                anyString(), anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), anyString(), anyString(), anyString());
        verify(guestRepository, never()).save(any());
    }

    @Test
    void nonresponderReminder_notSent_whenWeddingDateNull() {
        UUID coupleId = UUID.randomUUID();
        WeddingWebsite noDate = wedding(coupleId, null, "100 Chapel Rd", "Austin");

        lenient().when(websiteRepository.findByWeddingDateBetween(eq(today.plusDays(29)), eq(today.plusDays(31))))
                .thenReturn(List.of(noDate));

        service().sendCampaignReminders();

        verify(guestRepository, never()).findNonresponderReminderTargets(any());
        verify(asyncEmailService, never()).sendNonresponderReminderEmail(
                anyString(), anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void nonresponderReminder_notSent_whenVenueAddressNull() {
        UUID coupleId = UUID.randomUUID();
        WeddingWebsite noVenue = wedding(coupleId, today.plusDays(30), null, "Austin");

        lenient().when(websiteRepository.findByWeddingDateBetween(eq(today.plusDays(29)), eq(today.plusDays(31))))
                .thenReturn(List.of(noVenue));

        service().sendCampaignReminders();

        verify(guestRepository, never()).findNonresponderReminderTargets(any());
        verify(asyncEmailService, never()).sendNonresponderReminderEmail(
                anyString(), anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void attendingReminder_sentAndStamped_forAttendingGuestSevenDaysOut() {
        UUID coupleId = UUID.randomUUID();
        WeddingWebsite wedding = wedding(coupleId, today.plusDays(7), "100 Chapel Rd", "Austin");
        Guest attending = guest(coupleId, GuestRsvpStatus.ATTENDING, null, null);

        lenient().when(websiteRepository.findByWeddingDateBetween(eq(today.plusDays(6)), eq(today.plusDays(8))))
                .thenReturn(List.of(wedding));
        when(guestRepository.findAttendingReminderTargets(coupleId)).thenReturn(List.of(attending));

        service().sendCampaignReminders();

        verify(asyncEmailService).sendAttendingReminderEmail(
                eq("guest@example.com"), eq("Guest"), anyString(), anyString(),
                eq("100 Chapel Rd"), eq("Austin"), anyString(), anyString(), anyString());
        // The attending reminder carries no RSVP action, so it mints no token.
        verify(tokenRepository, never()).save(any());

        ArgumentCaptor<Guest> saved = ArgumentCaptor.forClass(Guest.class);
        verify(guestRepository).save(saved.capture());
        assertThat(saved.getValue().attendingReminderSentAt()).isNotNull();
    }

    // --- fixtures ------------------------------------------------------------------------------

    private static Guest guest(UUID coupleId, GuestRsvpStatus status,
                               OffsetDateTime nonresponderMarker, OffsetDateTime attendingMarker) {
        return new Guest(
                UUID.randomUUID(), coupleId, "Guest", "guest@example.com", null,
                status, false, null, null, null,
                null, null, null,
                null, null, null, null, null,
                null, 0,
                null, null, null, null, null, null,
                null, null, null,
                null, false,
                nonresponderMarker, attendingMarker);
    }

    // Minimal wedding: only the fields the reminder flow reads are populated, the rest are null.
    private static WeddingWebsite wedding(UUID coupleId, LocalDate weddingDate,
                                          String venueAddress, String venueCity) {
        return new WeddingWebsite(
                UUID.randomUUID(), coupleId, "eden-and-jordan", true,
                "Eden", "Jordan", weddingDate, null,
                null, null, null, null, null,
                null, null, null, null,
                "Grace Chapel", venueAddress, venueCity, "TX", "4:00 PM", null,
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
