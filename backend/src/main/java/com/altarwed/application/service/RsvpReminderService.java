package com.altarwed.application.service;

import com.altarwed.domain.model.Guest;
import com.altarwed.domain.port.GuestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

// Scheduled service that polls once per hour for guests who requested a reminder.
// When remind_at <= now and rsvpStatus = PENDING, it re-sends the RSVP invite
// and clears remind_at so the job won't fire twice for the same guest.
//
// Why a poll loop rather than a timer per guest?
// The MVP runs on a single Azure App Service instance where an in-process
// ScheduledExecutorService would work. A poll loop is simpler to reason about,
// survives app restarts without a distributed scheduler, and is cheap at this scale
// (SQL query over a small table, hourly). When we have thousands of concurrent guests
// and need sub-minute precision, upgrade to Azure Service Bus scheduled messages.
@Service
public class RsvpReminderService {

    private static final Logger log = LoggerFactory.getLogger(RsvpReminderService.class);

    private final GuestRepository guestRepository;
    private final GuestService guestService;

    public RsvpReminderService(GuestRepository guestRepository, GuestService guestService) {
        this.guestRepository = guestRepository;
        this.guestService = guestService;
    }

    // fixedRate = 3_600_000 ms = 1 hour. initialDelay avoids a burst immediately on startup.
    @Scheduled(fixedRate = 3_600_000, initialDelay = 60_000)
    @Transactional
    public void sendDueReminders() {
        List<Guest> due = guestRepository.findDueReminders(LocalDateTime.now());
        if (due.isEmpty()) return;

        log.info("RsvpReminderService: sending {} reminder(s)", due.size());
        for (Guest guest : due) {
            try {
                // issueInvite increments inviteSendCount, issues a fresh token, sends the email,
                // and clears remindAt. It respects the MAX_INVITE_SENDS cap — if the cap is hit
                // the call throws, which we catch so one over-limit guest doesn't abort the batch.
                guestService.sendInvite(guest.coupleId(), guest.id());
                log.debug("Reminder sent to guestId={}", guest.id());
            } catch (Exception ex) {
                // Log and continue — never let one failed reminder abort the rest of the batch.
                log.warn("Failed to send reminder for guestId={}: {}", guest.id(), ex.getMessage());
            }
        }
    }
}
