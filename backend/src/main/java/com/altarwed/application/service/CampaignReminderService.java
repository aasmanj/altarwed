package com.altarwed.application.service;

import com.altarwed.domain.model.Guest;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.GuestRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import net.javacrumbs.shedlock.core.LockAssert;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * Date-offset RSVP campaign reminders (issue #458). Once per hour this scheduler finds the couples
 * entering a campaign window and enqueues at most one reminder per guest through the durable email
 * outbox:
 *   - about 30 days out (29-31): a nudge to still-PENDING guests with their RSVP link.
 *   - about 7 days out (6-8):    venue details to ATTENDING guests.
 * Both carry an add-to-calendar link.
 *
 * The scheduler itself is intentionally NOT @Transactional (mirrors RsvpReminderService): each
 * per-guest enqueue-and-stamp is its own committed unit of work in {@link CampaignReminderSender},
 * so one guest failing (bad token insert, serialization) never rolls back the rest of the batch.
 * A guest is stamped the moment its reminder is queued, and the target queries filter on the
 * still-null marker, so a re-run (or a scale-out to more instances, guarded by @SchedulerLock)
 * cannot double-send.
 *
 * Scale note: only couples inside a three-day window are read each hour, never the whole table, so
 * this stays cheap as the platform grows. When sub-hour precision or many drainers are needed,
 * swap the poll for a scheduled-message broker behind the same repositories.
 */
@Service
public class CampaignReminderService {

    private static final Logger log = LoggerFactory.getLogger(CampaignReminderService.class);

    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("MMMM d, yyyy");

    // Inclusive day-offset windows from "today". A three-day width absorbs the once-an-hour cadence
    // and any single missed run without letting a wedding slip past the window unremindered.
    static final int NONRESPONDER_MIN_DAYS = 29;
    static final int NONRESPONDER_MAX_DAYS = 31;
    static final int ATTENDING_MIN_DAYS = 6;
    static final int ATTENDING_MAX_DAYS = 8;

    private final WeddingWebsiteRepository websiteRepository;
    private final GuestRepository guestRepository;
    private final EmailSuppressionService suppressionService;
    private final CampaignReminderSender sender;

    public CampaignReminderService(WeddingWebsiteRepository websiteRepository,
                                   GuestRepository guestRepository,
                                   EmailSuppressionService suppressionService,
                                   CampaignReminderSender sender) {
        this.websiteRepository = websiteRepository;
        this.guestRepository = guestRepository;
        this.suppressionService = suppressionService;
        this.sender = sender;
    }

    // fixedRate = 1 hour; initialDelay avoids a burst on startup. @SchedulerLock (issue #44 idiom)
    // keeps a scaled-out deployment from sending each reminder once per instance in the same window:
    // lockAtMostFor is shorter than the interval so a crashed instance frees the lock before the next
    // run, lockAtLeastFor absorbs clock skew between instances.
    @Scheduled(fixedRate = 3_600_000, initialDelay = 60_000)
    @SchedulerLock(name = "CampaignReminderService_sendCampaignReminders",
            lockAtMostFor = "55m", lockAtLeastFor = "1m")
    public void sendCampaignReminders() {
        // Catches an AOP misconfiguration (missing proxy, self-invocation) that would silently
        // disable the lock. Unit tests call LockAssert.TestHelper.makeAllAssertsPass(true).
        LockAssert.assertLocked();
        UUID runId = UUID.randomUUID();
        long startMs = System.currentTimeMillis();
        LocalDate today = LocalDate.now();

        int nonresponderSent = sendNonresponderReminders(runId, today);
        int attendingSent = sendAttendingReminders(runId, today);

        log.info("campaign reminder job finished, runId={}, nonresponderSent={}, attendingSent={}, durationMs={}",
                runId, nonresponderSent, attendingSent, System.currentTimeMillis() - startMs);
    }

    private int sendNonresponderReminders(UUID runId, LocalDate today) {
        List<WeddingWebsite> weddings = websiteRepository.findByWeddingDateBetween(
                today.plusDays(NONRESPONDER_MIN_DAYS), today.plusDays(NONRESPONDER_MAX_DAYS));
        log.info("campaign nonresponder reminders starting, runId={}, weddingCount={}", runId, weddings.size());

        int sent = 0;
        int failed = 0;
        int suppressed = 0;
        int skippedVenue = 0;
        for (WeddingWebsite wedding : weddings) {
            if (wedding.weddingDate() == null) continue; // defensive; the query already excludes null
            if (!hasCompleteVenue(wedding)) {
                skippedVenue++;
                continue;
            }
            ReminderContext ctx = contextFor(wedding);
            for (Guest guest : guestRepository.findNonresponderReminderTargets(wedding.coupleId())) {
                if (guest.nonresponderReminderSentAt() != null) continue; // defensive against a stale read
                if (isSuppressed(wedding.coupleId(), guest.email())) {
                    suppressed++;
                    continue;
                }
                try {
                    sender.sendNonresponderReminder(guest, ctx);
                    sent++;
                } catch (Exception ex) {
                    failed++;
                    log.error("campaign nonresponder reminder failed, runId={}, coupleId={}, guestId={}",
                            runId, wedding.coupleId(), guest.id(), ex);
                }
            }
        }
        log.info("campaign nonresponder reminders sent, runId={}, sent={}, failed={}, suppressed={}, skippedIncompleteVenue={}",
                runId, sent, failed, suppressed, skippedVenue);
        return sent;
    }

    private int sendAttendingReminders(UUID runId, LocalDate today) {
        List<WeddingWebsite> weddings = websiteRepository.findByWeddingDateBetween(
                today.plusDays(ATTENDING_MIN_DAYS), today.plusDays(ATTENDING_MAX_DAYS));
        log.info("campaign attending reminders starting, runId={}, weddingCount={}", runId, weddings.size());

        int sent = 0;
        int failed = 0;
        int suppressed = 0;
        int skippedVenue = 0;
        for (WeddingWebsite wedding : weddings) {
            if (wedding.weddingDate() == null) continue; // defensive; the query already excludes null
            if (!hasCompleteVenue(wedding)) {
                skippedVenue++;
                continue;
            }
            ReminderContext ctx = contextFor(wedding);
            for (Guest guest : guestRepository.findAttendingReminderTargets(wedding.coupleId())) {
                if (guest.attendingReminderSentAt() != null) continue; // defensive against a stale read
                if (isSuppressed(wedding.coupleId(), guest.email())) {
                    suppressed++;
                    continue;
                }
                try {
                    sender.sendAttendingReminder(guest, ctx);
                    sent++;
                } catch (Exception ex) {
                    failed++;
                    log.error("campaign attending reminder failed, runId={}, coupleId={}, guestId={}",
                            runId, wedding.coupleId(), guest.id(), ex);
                }
            }
        }
        log.info("campaign attending reminders sent, runId={}, sent={}, failed={}, suppressed={}, skippedIncompleteVenue={}",
                runId, sent, failed, suppressed, skippedVenue);
        return sent;
    }

    // A reminder with no venue address or city is useless (the whole point of the 7-day nudge is
    // "here is where to go"), so skip the couple until they finish it rather than send a blank.
    private static boolean hasCompleteVenue(WeddingWebsite wedding) {
        return wedding.venueAddress() != null && !wedding.venueAddress().isBlank()
                && wedding.venueCity() != null && !wedding.venueCity().isBlank();
    }

    private boolean isSuppressed(UUID coupleId, String email) {
        if (email == null || email.isBlank()) return true;
        return suppressionService.isSuppressed(coupleId, EmailSuppressionService.emailHash(email));
    }

    private static ReminderContext contextFor(WeddingWebsite wedding) {
        String coupleNames = coupleNames(wedding);
        String display = wedding.weddingDate().format(DISPLAY_DATE);
        String calendarUrl = GoogleCalendarLink.build(coupleNames, wedding.weddingDate(),
                wedding.ceremonyTime(), wedding.venueAddress(), wedding.venueCity(), wedding.venueState());
        return new ReminderContext(coupleNames, display, wedding.weddingDate(),
                wedding.venueAddress(), wedding.venueCity(), wedding.venueState(),
                wedding.ceremonyTime(), calendarUrl);
    }

    private static String coupleNames(WeddingWebsite wedding) {
        String one = wedding.partnerOneName();
        String two = wedding.partnerTwoName();
        if (one != null && !one.isBlank() && two != null && !two.isBlank()) {
            return one + " & " + two;
        }
        if (one != null && !one.isBlank()) return one;
        if (two != null && !two.isBlank()) return two;
        return "The Couple";
    }

    /**
     * Wedding-level fields shared by every guest of one couple, computed once per wedding so the
     * per-guest send does no repeated formatting. weddingDate is the raw date (for token expiry);
     * weddingDateDisplay is the human string the email renders.
     */
    public record ReminderContext(String coupleNames, String weddingDateDisplay, LocalDate weddingDate,
                                  String venueAddress, String venueCity, String venueState,
                                  String ceremonyTime, String googleCalendarUrl) {}
}
