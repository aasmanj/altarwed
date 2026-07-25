package com.altarwed.domain.model.email;

import com.altarwed.domain.model.EmailRecipient;
import com.altarwed.domain.model.RsvpInviteRecipient;

import java.util.List;
import java.util.UUID;

/**
 * The serialisable argument envelopes for each {@link EmailType}. One nested
 * record per EmailPort operation, holding exactly the arguments that call had.
 *
 * These are pure domain value objects with no framework dependencies. They are
 * serialised to the email_outbox.payload JSON column on enqueue and rehydrated
 * on send, so the actual (slow, external) EmailPort call happens on the outbox
 * sender's thread rather than on the caller's request thread. Jackson maps these
 * records natively via their record components, so no annotations are required.
 *
 * Boxed types (Boolean) are used deliberately: these round-trip through JSON, so
 * a boxed field tolerates an absent value rather than defaulting silently.
 */
public final class OutboxPayloads {

    private OutboxPayloads() {}

    public record PasswordReset(String toEmail, String resetToken) {}

    public record Welcome(String toEmail, String partnerOneName, String partnerTwoName) {}

    public record AccountDeleted(String toEmail, String partnerOneName, String partnerTwoName) {}

    public record WeddingPublished(String toEmail, String partnerOneName,
                                   String partnerTwoName, String weddingUrl) {}

    public record RsvpInvite(String toEmail, String guestName, String coupleNames,
                             String weddingDate, String rsvpToken, UUID guestId,
                             UUID coupleId, String coupleReplyToEmail) {}

    public record SaveTheDateBatch(List<EmailRecipient> recipients, UUID coupleId,
                                   String coupleNames, String weddingDate, String weddingUrl,
                                   String stdImageUrl, String coupleReplyToEmail) {}

    public record RsvpInviteBatch(List<RsvpInviteRecipient> recipients, UUID coupleId,
                                  String coupleNames, String weddingDate,
                                  String coupleReplyToEmail) {}

    public record RsvpNotificationToCouple(String coupleEmail, String coupleNames,
                                           String guestName, String rsvpStatus,
                                           String noteForCouple, String dashboardUrl,
                                           String guestReplyToEmail) {}

    public record VendorWelcome(String toEmail, String businessName, String listingUrl,
                                String dashboardUrl, Boolean isFoundingVendor) {}

    public record VendorVerified(String toEmail, String businessName,
                                 String listingUrl, String dashboardUrl) {}

    public record VendorRegistrationAlert(String businessName, String category, String city,
                                          String state, String vendorEmail, String vendorId,
                                          String adminListingUrl, Boolean autoVerified) {}

    public record CoupleWebsiteCreatedAlert(String coupleEmail, String partnerOneName,
                                            String partnerTwoName, String slug, String siteUrl) {}

    public record VendorInquiry(String vendorEmail, String vendorBusinessName, String coupleName,
                                String coupleEmail, String weddingDate, String message,
                                String vendorProfileUrl) {}

    public record VendorInquiryConfirmation(String coupleEmail, String coupleName,
                                            String vendorBusinessName, String vendorProfileUrl) {}

    // Date-offset RSVP campaign reminders (issue #458). weddingDate is the display string
    // ("June 20, 2026"); the venue and ceremonyTime fields carry the details the reminder
    // renders; googleCalendarUrl is the prebuilt add-to-calendar link. rsvpToken is the fresh
    // RSVP link token for the nonresponder nudge (null for the attending reminder, which carries
    // no RSVP action). ceremonyTime is the couple's free-form string (e.g. "4:00 PM") or null.
    public record RsvpNonresponderReminder(String toEmail, String guestName, String coupleNames,
                                           String weddingDate, String venueAddress, String venueCity,
                                           String venueState, String ceremonyTime, String rsvpToken,
                                           String googleCalendarUrl) {}

    public record AttendingReminder(String toEmail, String guestName, String coupleNames,
                                    String weddingDate, String venueAddress, String venueCity,
                                    String venueState, String ceremonyTime,
                                    String googleCalendarUrl) {}
}
