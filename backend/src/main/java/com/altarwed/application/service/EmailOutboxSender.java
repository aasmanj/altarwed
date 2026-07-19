package com.altarwed.application.service;

import com.altarwed.domain.model.email.EmailOutboxEntry;
import com.altarwed.domain.model.email.OutboxPayloads;
import com.altarwed.domain.port.EmailOutboxRepository;
import com.altarwed.domain.port.EmailPort;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.javacrumbs.shedlock.core.LockAssert;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Drains the durable email outbox (issue #377): the read side of the transactional outbox
 * pattern. AsyncEmailService enqueues PENDING rows inside business transactions; this poller
 * pulls the due rows off the queue, calls the EmailPort, and marks each SENT, or retries it
 * with exponential backoff, or gives up to FAILED after a bounded number of attempts.
 *
 * Why a poll loop rather than a message broker: the send-intent is already durable in SQL
 * Server, so a restart or crash can no longer lose mail (the bug this fixes). A poll loop needs
 * no extra infrastructure (Service Bus is explicitly deferred in the issue) and mirrors the
 * established GoogleSheetPollingJob / RsvpReminderService idiom. When volume demands sub-second
 * latency or many drainers, swap the poll for Service Bus scheduled messages behind this port.
 *
 * Delivery is at-least-once: a row flips to SENT only after the provider accepts it, so a crash
 * between "provider accepted" and "row marked SENT" re-sends on the next poll. That is the
 * correct trade-off versus the old at-most-once behaviour that dropped mail outright.
 */
@Service
public class EmailOutboxSender {

    private static final Logger log = LoggerFactory.getLogger(EmailOutboxSender.class);

    // Total send attempts before a row is parked as FAILED. attempts starts at 0, so a row is
    // tried at attempts 0..4 and parked when the fifth attempt fails.
    static final int MAX_ATTEMPTS = 5;

    // Rows drained per poll. Bounds memory and keeps one instance from monopolising the provider;
    // leftover due rows are picked up on the next poll a few seconds later.
    static final int BATCH_LIMIT = 50;

    // Exponential backoff between retries: 60s, 120s, 240s, 480s, capped. Spreads transient
    // provider/network failures out instead of hammering a struggling dependency.
    private static final long BACKOFF_BASE_SECONDS = 60L;
    private static final long BACKOFF_CAP_SECONDS = 3_600L;

    private static final int MAX_LAST_ERROR_LENGTH = 1_900;

    private final EmailOutboxRepository outboxRepository;
    private final EmailPort emailPort;
    private final ObjectMapper objectMapper;

    public EmailOutboxSender(EmailOutboxRepository outboxRepository, EmailPort emailPort,
                             ObjectMapper objectMapper) {
        this.outboxRepository = outboxRepository;
        this.emailPort = emailPort;
        this.objectMapper = objectMapper;
    }

    // fixedDelay = 15s so a queued password reset or invite goes out within seconds of enqueue,
    // while still batching. initialDelay avoids draining before the instance is warm.
    // @SchedulerLock (issue #44 idiom): only one instance drains at a time once we scale out past
    // one App Service instance, so two instances can never both send the same PENDING row.
    // lockAtMostFor is a crash safety net (a dead instance's lock frees after it) shorter than the
    // interval matters less here because a SENT row is filtered out of the next drain regardless.
    @Scheduled(fixedDelay = 15_000, initialDelay = 30_000)
    @SchedulerLock(name = "EmailOutboxSender_drain", lockAtMostFor = "5m")
    public void drain() {
        // See RsvpReminderService.sendDueReminders() for why this assertion is here: it catches an
        // AOP misconfiguration that would silently disable the lock. Unit tests call
        // LockAssert.TestHelper.makeAllAssertsPass(true) so plain `new` construction passes.
        LockAssert.assertLocked();
        UUID runId = UUID.randomUUID();
        long startMs = System.currentTimeMillis();
        try {
            List<EmailOutboxEntry> due = outboxRepository.findSendable(LocalDateTime.now(), BATCH_LIMIT);
            log.info("email outbox drain started, runId={}, dueCount={}", runId, due.size());
            if (due.isEmpty()) return;

            int sent = 0;
            int retried = 0;
            int failed = 0;
            for (EmailOutboxEntry entry : due) {
                try {
                    dispatch(entry);
                    outboxRepository.markSent(entry.id(), LocalDateTime.now());
                    sent++;
                } catch (Exception ex) {
                    int attempts = entry.attempts() + 1;
                    String lastError = describe(ex);
                    if (attempts >= MAX_ATTEMPTS) {
                        // Exhausted: park it. WARN (not ERROR) so a single undeliverable address does
                        // not page on-call; the aggregate failed count on the finish line is the signal.
                        outboxRepository.markFailed(entry.id(), attempts, lastError);
                        failed++;
                        log.warn("email outbox send exhausted, runId={}, outboxId={}, type={}, attempts={}",
                                runId, entry.id(), entry.type(), attempts, ex);
                    } else {
                        LocalDateTime next = LocalDateTime.now().plusSeconds(backoffSeconds(attempts));
                        outboxRepository.markForRetry(entry.id(), attempts, next, lastError);
                        retried++;
                        log.warn("email outbox send failed, will retry, runId={}, outboxId={}, type={}, attempts={}",
                                runId, entry.id(), entry.type(), attempts, ex);
                    }
                }
            }
            log.info("email outbox drain finished, runId={}, processed={}, sent={}, retried={}, failed={}, durationMs={}",
                    runId, due.size(), sent, retried, failed, System.currentTimeMillis() - startMs);
        } catch (Exception ex) {
            log.error("email outbox drain crashed, runId={}, durationMs={}",
                    runId, System.currentTimeMillis() - startMs, ex);
            throw ex;
        }
    }

    // Rehydrates the type-specific payload and replays the original EmailPort call. Any provider
    // failure propagates so the caller records a retry; deserialisation failure is treated the
    // same (a malformed row will exhaust its attempts and park as FAILED rather than blocking).
    private void dispatch(EmailOutboxEntry entry) throws Exception {
        String json = entry.payload();
        switch (entry.type()) {
            case PASSWORD_RESET -> {
                var p = objectMapper.readValue(json, OutboxPayloads.PasswordReset.class);
                emailPort.sendPasswordResetEmail(p.toEmail(), p.resetToken());
            }
            case WELCOME -> {
                var p = objectMapper.readValue(json, OutboxPayloads.Welcome.class);
                emailPort.sendWelcomeEmail(p.toEmail(), p.partnerOneName(), p.partnerTwoName());
            }
            case ACCOUNT_DELETED -> {
                var p = objectMapper.readValue(json, OutboxPayloads.AccountDeleted.class);
                emailPort.sendAccountDeletedEmail(p.toEmail(), p.partnerOneName(), p.partnerTwoName());
            }
            case WEDDING_PUBLISHED -> {
                var p = objectMapper.readValue(json, OutboxPayloads.WeddingPublished.class);
                emailPort.sendWeddingPublishedEmail(p.toEmail(), p.partnerOneName(),
                        p.partnerTwoName(), p.weddingUrl());
            }
            case RSVP_INVITE -> {
                var p = objectMapper.readValue(json, OutboxPayloads.RsvpInvite.class);
                emailPort.sendRsvpInviteEmail(p.toEmail(), p.guestName(), p.coupleNames(),
                        p.weddingDate(), p.rsvpToken(), p.guestId(), p.coupleId(), p.coupleReplyToEmail());
            }
            case SAVE_THE_DATE_BATCH -> {
                var p = objectMapper.readValue(json, OutboxPayloads.SaveTheDateBatch.class);
                emailPort.sendSaveTheDateEmails(p.recipients(), p.coupleId(), p.coupleNames(),
                        p.weddingDate(), p.weddingUrl(), p.stdImageUrl(), p.coupleReplyToEmail());
            }
            case RSVP_INVITE_BATCH -> {
                var p = objectMapper.readValue(json, OutboxPayloads.RsvpInviteBatch.class);
                emailPort.sendRsvpInviteEmails(p.recipients(), p.coupleId(), p.coupleNames(),
                        p.weddingDate(), p.coupleReplyToEmail());
            }
            case RSVP_NOTIFICATION_TO_COUPLE -> {
                var p = objectMapper.readValue(json, OutboxPayloads.RsvpNotificationToCouple.class);
                emailPort.sendRsvpNotificationToCouple(p.coupleEmail(), p.coupleNames(), p.guestName(),
                        p.rsvpStatus(), p.noteForCouple(), p.dashboardUrl(), p.guestReplyToEmail());
            }
            case VENDOR_WELCOME -> {
                var p = objectMapper.readValue(json, OutboxPayloads.VendorWelcome.class);
                emailPort.sendVendorWelcomeEmail(p.toEmail(), p.businessName(), p.listingUrl(),
                        p.dashboardUrl(), Boolean.TRUE.equals(p.isFoundingVendor()));
            }
            case VENDOR_VERIFIED -> {
                var p = objectMapper.readValue(json, OutboxPayloads.VendorVerified.class);
                emailPort.sendVendorVerifiedEmail(p.toEmail(), p.businessName(), p.listingUrl(),
                        p.dashboardUrl());
            }
            case VENDOR_REGISTRATION_ALERT -> {
                var p = objectMapper.readValue(json, OutboxPayloads.VendorRegistrationAlert.class);
                emailPort.sendVendorRegistrationAlert(p.businessName(), p.category(), p.city(),
                        p.state(), p.vendorEmail(), p.vendorId(), p.adminListingUrl(),
                        Boolean.TRUE.equals(p.autoVerified()));
            }
            case COUPLE_WEBSITE_CREATED_ALERT -> {
                var p = objectMapper.readValue(json, OutboxPayloads.CoupleWebsiteCreatedAlert.class);
                emailPort.sendCoupleWebsiteCreatedAlert(p.coupleEmail(), p.partnerOneName(),
                        p.partnerTwoName(), p.slug(), p.siteUrl());
            }
            case VENDOR_INQUIRY -> {
                var p = objectMapper.readValue(json, OutboxPayloads.VendorInquiry.class);
                emailPort.sendVendorInquiryEmail(p.vendorEmail(), p.vendorBusinessName(), p.coupleName(),
                        p.coupleEmail(), p.weddingDate(), p.message(), p.vendorProfileUrl());
            }
            case VENDOR_INQUIRY_CONFIRMATION -> {
                var p = objectMapper.readValue(json, OutboxPayloads.VendorInquiryConfirmation.class);
                emailPort.sendVendorInquiryConfirmation(p.coupleEmail(), p.coupleName(),
                        p.vendorBusinessName(), p.vendorProfileUrl());
            }
            case RSVP_NONRESPONDER_REMINDER -> {
                var p = objectMapper.readValue(json, OutboxPayloads.RsvpNonresponderReminder.class);
                emailPort.sendNonresponderReminderEmail(p.toEmail(), p.guestName(), p.coupleNames(),
                        p.weddingDate(), p.venueAddress(), p.venueCity(), p.venueState(),
                        p.ceremonyTime(), p.rsvpToken(), p.googleCalendarUrl());
            }
            case ATTENDING_REMINDER -> {
                var p = objectMapper.readValue(json, OutboxPayloads.AttendingReminder.class);
                emailPort.sendAttendingReminderEmail(p.toEmail(), p.guestName(), p.coupleNames(),
                        p.weddingDate(), p.venueAddress(), p.venueCity(), p.venueState(),
                        p.ceremonyTime(), p.googleCalendarUrl());
            }
        }
    }

    private long backoffSeconds(int attempts) {
        long shifted = BACKOFF_BASE_SECONDS << Math.min(attempts - 1, 20);
        return Math.min(BACKOFF_CAP_SECONDS, shifted);
    }

    // Compact, bounded diagnostic for the last_error column. Exception type plus message so an
    // operator can triage without an unbounded stack trace bloating the row.
    private String describe(Exception ex) {
        String message = ex.getMessage() == null ? "" : ex.getMessage();
        String combined = ex.getClass().getName() + ": " + message;
        return combined.length() > MAX_LAST_ERROR_LENGTH
                ? combined.substring(0, MAX_LAST_ERROR_LENGTH)
                : combined;
    }
}
