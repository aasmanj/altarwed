package com.altarwed.application.service;

import com.altarwed.domain.model.Guest;
import com.altarwed.domain.port.GuestRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

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
    //
    // Intentionally NOT @Transactional (mirrors GoogleSheetSyncService.triggerSync). An outer
    // transaction here would make every per-guest send share one unit of work: when one guest
    // throws (invite cap or GuestUnsubscribedException), the inner @Transactional sendInvite
    // interceptor marks the shared transaction rollback-only, so even though the catch below
    // swallows the exception, the whole batch dies at commit with UnexpectedRollbackException,
    // undoing every other guest's token save and remindAt clear (and re-reminding them next run).
    // Without it, each guestService.sendInvite call is its own committed unit of work, so one
    // failed guest is skipped and counted, never fatal to the rest.
    // Issue #44: on the launch-time scale-out past one instance, every due reminder would
    // otherwise be emailed once per instance in the same hourly window. lockAtMostFor is a
    // crash safety net (shorter than the 1h interval so a dead instance can't hold the lock
    // into the next run); lockAtLeastFor absorbs clock skew between instances so a second
    // instance starting moments later can't slip in right after the first releases the lock.
    @Scheduled(fixedRate = 3_600_000, initialDelay = 60_000)
    @SchedulerLock(name = "RsvpReminderService_sendDueReminders", lockAtMostFor = "55m", lockAtLeastFor = "1m")
    public void sendDueReminders() {
        // Catches AOP misconfiguration (missing proxy, self-invocation) that would silently
        // disable the lock and reintroduce the double-fire this fix exists to prevent.
        // RsvpReminderServiceTest calls LockAssert.TestHelper.makeAllAssertsPass(true) so plain
        // `new RsvpReminderService(...)` unit tests (no Spring proxy) don't trip this.
        LockAssert.assertLocked();
        UUID runId = UUID.randomUUID();
        long startMs = System.currentTimeMillis();
        List<Guest> due = guestRepository.findDueReminders(LocalDateTime.now());
        log.info("rsvp reminder job started, runId={}, dueCount={}", runId, due.size());
        if (due.isEmpty()) return;

        int sent = 0;
        int failed = 0;
        for (Guest guest : due) {
            try {
                // issueInvite increments inviteSendCount, issues a fresh token, sends the email,
                // and clears remindAt. It respects the MAX_INVITE_SENDS cap; if the cap is hit
                // the call throws, which we catch so one over-limit guest doesn't abort the batch.
                guestService.sendInvite(guest.coupleId(), guest.id());
                sent++;
            } catch (Exception ex) {
                // Log and continue: never let one failed reminder abort the rest of the batch.
                failed++;
                log.warn("rsvp reminder failed for guest, runId={}, guestId={}, coupleId={}",
                         runId, guest.id(), guest.coupleId(), ex);
            }
        }
        log.info("rsvp reminder job finished, runId={}, sent={}, failed={}, durationMs={}",
                 runId, sent, failed, System.currentTimeMillis() - startMs);
    }
}
