package com.altarwed.application.service;

import com.altarwed.domain.model.EmailRecipient;
import com.altarwed.domain.model.RsvpInviteRecipient;
import com.altarwed.domain.model.email.EmailOutboxEntry;
import com.altarwed.domain.model.email.EmailType;
import com.altarwed.domain.model.email.OutboxPayloads;
import com.altarwed.domain.port.EmailOutboxRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Enqueue facade for the durable email outbox (issue #377).
 *
 * Historically this was a thin @Async wrapper that handed each send to an in-memory
 * executor, so a direct-to-prod restart or crash silently dropped anything still queued
 * (welcome mail, RSVP reminders, password resets, vendor inquiry alerts). It is now the
 * write side of the transactional outbox pattern: every method serialises its arguments
 * into a durable email_outbox row instead of sending inline.
 *
 * The enqueue is a single cheap INSERT that participates in the caller's transaction, so
 * when a business service (registration, publish, inquiry) calls this inside its own
 * {@code @Transactional} method the send-intent commits or rolls back atomically with that
 * change. A row is never lost to a restart, and an email is never sent for a change that
 * rolled back. {@link EmailOutboxSender} performs the actual (slow, external) provider call
 * off the request thread.
 *
 * The public method signatures are unchanged so existing call sites do not churn; only the
 * internals moved from fire-and-forget async to durable enqueue.
 */
@Service
public class AsyncEmailService {

    private static final Logger log = LoggerFactory.getLogger(AsyncEmailService.class);

    private final EmailOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;

    public AsyncEmailService(EmailOutboxRepository outboxRepository, ObjectMapper objectMapper) {
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
    }

    public void sendRsvpInviteEmail(String toEmail, String guestName,
                                    String coupleNames, String weddingDate, String rsvpToken,
                                    UUID guestId, UUID coupleId, String coupleReplyToEmail) {
        enqueue(EmailType.RSVP_INVITE, toEmail,
                new OutboxPayloads.RsvpInvite(toEmail, guestName, coupleNames, weddingDate,
                        rsvpToken, guestId, coupleId, coupleReplyToEmail));
    }

    // A single row carries the whole invite list; the sender fans it out through the
    // provider's batch API in one drain, so a 300-guest send survives a restart intact
    // instead of leaving hundreds of tasks stranded in an in-memory queue.
    public void sendRsvpInviteEmails(List<RsvpInviteRecipient> recipients, UUID coupleId, String coupleNames,
                                     String weddingDate, String coupleReplyToEmail) {
        enqueue(EmailType.RSVP_INVITE_BATCH, null,
                new OutboxPayloads.RsvpInviteBatch(recipients, coupleId, coupleNames, weddingDate,
                        coupleReplyToEmail));
    }

    public void sendSaveTheDateEmails(List<EmailRecipient> recipients, UUID coupleId, String coupleNames,
                                      String weddingDate, String weddingUrl, String stdImageUrl,
                                      String coupleReplyToEmail) {
        enqueue(EmailType.SAVE_THE_DATE_BATCH, null,
                new OutboxPayloads.SaveTheDateBatch(recipients, coupleId, coupleNames, weddingDate,
                        weddingUrl, stdImageUrl, coupleReplyToEmail));
    }

    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        enqueue(EmailType.PASSWORD_RESET, toEmail,
                new OutboxPayloads.PasswordReset(toEmail, resetToken));
    }

    public void sendWelcomeEmail(String toEmail, String partnerOneName, String partnerTwoName) {
        enqueue(EmailType.WELCOME, toEmail,
                new OutboxPayloads.Welcome(toEmail, partnerOneName, partnerTwoName));
    }

    public void sendAccountDeletedEmail(String toEmail, String partnerOneName, String partnerTwoName) {
        enqueue(EmailType.ACCOUNT_DELETED, toEmail,
                new OutboxPayloads.AccountDeleted(toEmail, partnerOneName, partnerTwoName));
    }

    public void sendRsvpNotificationToCouple(String coupleEmail, String coupleNames,
                                             String guestName, String rsvpStatus,
                                             String noteForCouple,
                                             String dashboardUrl,
                                             String guestReplyToEmail) {
        enqueue(EmailType.RSVP_NOTIFICATION_TO_COUPLE, coupleEmail,
                new OutboxPayloads.RsvpNotificationToCouple(coupleEmail, coupleNames, guestName,
                        rsvpStatus, noteForCouple, dashboardUrl, guestReplyToEmail));
    }

    public void sendVendorInquiryEmail(String vendorEmail, String vendorBusinessName,
                                       String coupleName, String coupleEmail,
                                       String weddingDate, String message,
                                       String vendorProfileUrl) {
        enqueue(EmailType.VENDOR_INQUIRY, vendorEmail,
                new OutboxPayloads.VendorInquiry(vendorEmail, vendorBusinessName, coupleName,
                        coupleEmail, weddingDate, message, vendorProfileUrl));
    }

    public void sendVendorInquiryConfirmation(String coupleEmail, String coupleName,
                                              String vendorBusinessName, String vendorProfileUrl) {
        enqueue(EmailType.VENDOR_INQUIRY_CONFIRMATION, coupleEmail,
                new OutboxPayloads.VendorInquiryConfirmation(coupleEmail, coupleName,
                        vendorBusinessName, vendorProfileUrl));
    }

    public void sendVendorRegistrationAlert(String businessName, String category,
                                            String city, String state, String vendorEmail,
                                            String vendorId, String adminListingUrl,
                                            boolean autoVerified) {
        enqueue(EmailType.VENDOR_REGISTRATION_ALERT, vendorEmail,
                new OutboxPayloads.VendorRegistrationAlert(businessName, category, city, state,
                        vendorEmail, vendorId, adminListingUrl, autoVerified));
    }

    public void sendWeddingPublishedEmail(String toEmail, String partnerOneName,
                                          String partnerTwoName, String weddingUrl) {
        enqueue(EmailType.WEDDING_PUBLISHED, toEmail,
                new OutboxPayloads.WeddingPublished(toEmail, partnerOneName, partnerTwoName, weddingUrl));
    }

    public void sendCoupleWebsiteCreatedAlert(String coupleEmail, String partnerOneName,
                                              String partnerTwoName, String slug, String siteUrl) {
        enqueue(EmailType.COUPLE_WEBSITE_CREATED_ALERT, coupleEmail,
                new OutboxPayloads.CoupleWebsiteCreatedAlert(coupleEmail, partnerOneName,
                        partnerTwoName, slug, siteUrl));
    }

    public void sendVendorWelcomeEmail(String toEmail, String businessName,
                                       String listingUrl, String dashboardUrl,
                                       boolean isFoundingVendor) {
        enqueue(EmailType.VENDOR_WELCOME, toEmail,
                new OutboxPayloads.VendorWelcome(toEmail, businessName, listingUrl, dashboardUrl,
                        isFoundingVendor));
    }

    public void sendVendorVerifiedEmail(String toEmail, String businessName,
                                        String listingUrl, String dashboardUrl) {
        enqueue(EmailType.VENDOR_VERIFIED, toEmail,
                new OutboxPayloads.VendorVerified(toEmail, businessName, listingUrl, dashboardUrl));
    }

    // Date-offset RSVP campaign reminders (issue #458). Same enqueue-only pattern as every other
    // send here: one durable PENDING row per guest, drained off-thread by EmailOutboxSender.
    // rsvpToken is the guest's fresh RSVP link token; the nonresponder nudge carries one, the
    // attending reminder passes null (it prompts no RSVP action).
    public void sendNonresponderReminderEmail(String toEmail, String guestName, String coupleNames,
                                              String weddingDate, String venueAddress, String venueCity,
                                              String venueState, String ceremonyTime, String rsvpToken,
                                              String googleCalendarUrl) {
        enqueue(EmailType.RSVP_NONRESPONDER_REMINDER, toEmail,
                new OutboxPayloads.RsvpNonresponderReminder(toEmail, guestName, coupleNames,
                        weddingDate, venueAddress, venueCity, venueState, ceremonyTime, rsvpToken,
                        googleCalendarUrl));
    }

    public void sendAttendingReminderEmail(String toEmail, String guestName, String coupleNames,
                                           String weddingDate, String venueAddress, String venueCity,
                                           String venueState, String ceremonyTime,
                                           String googleCalendarUrl) {
        enqueue(EmailType.ATTENDING_REMINDER, toEmail,
                new OutboxPayloads.AttendingReminder(toEmail, guestName, coupleNames, weddingDate,
                        venueAddress, venueCity, venueState, ceremonyTime, null, googleCalendarUrl));
    }

    // Serialises the payload and writes one PENDING row. recipient is a single low-cardinality
    // address kept only for operational queries (null for batch sends). We never log the address;
    // only the type and the internal outbox UUID reach the logs.
    private void enqueue(EmailType type, String recipient, Object payload) {
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            // Serialising a small internal record should never fail. If it somehow does, fail loud
            // so the enclosing business transaction rolls back rather than silently losing the mail.
            log.error("email outbox enqueue serialization failed, type={}", type, ex);
            throw new IllegalStateException("Failed to serialize outbox payload for type " + type, ex);
        }
        EmailOutboxEntry entry = EmailOutboxEntry.pending(type, recipient, json);
        outboxRepository.enqueue(entry);
        log.info("email enqueued, type={}, outboxId={}", type, entry.id());
    }
}
