package com.altarwed.domain.port;

import com.altarwed.domain.model.EmailRecipient;
import com.altarwed.domain.model.RsvpInviteRecipient;

import java.util.List;
import java.util.UUID;

public interface EmailPort {
    void sendPasswordResetEmail(String toEmail, String resetToken);

    // Sent once, right after a couple registers. Welcomes them and drives them
    // to the dashboard to start building their wedding website (the activation
    // step that matters for couples-shipped).
    void sendWelcomeEmail(String toEmail, String partnerOneName, String partnerTwoName);

    // Sent after a couple hard-deletes their account. Confirms the deletion is
    // permanent (a trust/compliance courtesy) and leaves the door open to return.
    void sendAccountDeletedEmail(String toEmail, String partnerOneName, String partnerTwoName);

    // Sent once when the couple publishes their wedding website for the first time
    // (and on every re-publish). Congratulates them and surfaces the shareable URL.
    void sendWeddingPublishedEmail(String toEmail, String partnerOneName, String partnerTwoName, String weddingUrl);

    // guestId/coupleId tag the outgoing message so the Resend delivery webhook can
    // map a delivery/bounce event back to this guest (see EmailDeliveryService).
    // coupleReplyToEmail is the couple's own account address; guest replies route there
    // (Reply-To) so they reach THIS couple's inbox, not the shared from-address. The
    // From stays on the verified altarwed.com domain (SPF/DKIM); we never spoof it.
    void sendRsvpInviteEmail(String toEmail, String guestName, String coupleNames, String weddingDate,
                             String rsvpToken, UUID guestId, UUID coupleId, String coupleReplyToEmail);

    // Bulk save-the-date send. Implementations fan the recipients out through the
    // provider's batch API so a 200-guest send is a couple of API calls rather than
    // 200, instead of tripping the per-second rate limit. Shared fields (coupleNames,
    // weddingDate, weddingUrl, stdImageUrl) are identical for every recipient; coupleId
    // and each recipient's guestId tag the message for delivery-webhook mapping.
    // coupleReplyToEmail routes guest replies to this couple's own inbox (Reply-To).
    void sendSaveTheDateEmails(List<EmailRecipient> recipients, UUID coupleId, String coupleNames,
                               String weddingDate, String weddingUrl, String stdImageUrl,
                               String coupleReplyToEmail);

    // Bulk RSVP invite send. Implementations fan the recipients out through the provider's
    // /emails/batch API so a 300-guest invite-all is a handful of API calls rather than 300,
    // instead of tripping the per-second rate limit (a spring-season invite burst would otherwise
    // sit in an hours-long backlog and arrive late or be dropped on the next deploy). Each
    // recipient carries its own rsvpToken because, unlike a save-the-date, every RSVP link is
    // per-guest; shared fields (coupleNames, weddingDate) are identical for every recipient.
    // coupleId plus each recipient's guestId tag the message for delivery-webhook mapping, and
    // coupleReplyToEmail routes guest replies to this couple's own inbox (Reply-To).
    void sendRsvpInviteEmails(List<RsvpInviteRecipient> recipients, UUID coupleId, String coupleNames,
                              String weddingDate, String coupleReplyToEmail);

    // Notifies the couple that a guest responded. guestReplyToEmail is the guest's own
    // address, set as Reply-To so the couple hitting reply reaches THAT guest, not the
    // shared from-address. Null when the guest has no email (e.g. an RSVP found by name);
    // the reply then falls back to the from-address.
    void sendRsvpNotificationToCouple(String coupleEmail, String coupleNames,
                                      String guestName, String rsvpStatus,
                                      String noteForCouple,
                                      String dashboardUrl,
                                      String guestReplyToEmail);

    // Sent once when a vendor registers. If isFoundingVendor=true the listing is already
    // live and the email says so; otherwise it explains the listing is under review.
    void sendVendorWelcomeEmail(String toEmail, String businessName,
                                String listingUrl, String dashboardUrl,
                                boolean isFoundingVendor);

    // Sent when an unverified vendor is approved (admin manually verifies, or promo code
    // redeemed). Not sent for founding vendors because they are already live at registration.
    void sendVendorVerifiedEmail(String toEmail, String businessName,
                                 String listingUrl, String dashboardUrl);

    // Internal admin alert, sent to the platform owner when a new vendor registers.
    // autoVerified=true means the vendor is already live (founding vendor, first 25);
    // false means they need manual verification before appearing in the directory.
    void sendVendorRegistrationAlert(String businessName, String category,
                                     String city, String state, String vendorEmail,
                                     String vendorId, String adminListingUrl,
                                     boolean autoVerified);

    // Internal admin alert, sent to the platform owner when a couple creates a new
    // wedding website so Jordan can track growth and reach out to early couples.
    void sendCoupleWebsiteCreatedAlert(String coupleEmail, String partnerOneName,
                                       String partnerTwoName, String slug, String siteUrl);

    // Vendor inquiry: the couple sends a question/booking inquiry to a vendor.
    // The vendor receives a formatted email with the couple's contact info and
    // can hit reply to respond (reply-to is set to coupleEmail). The couple
    // receives a confirmation copy.
    void sendVendorInquiryEmail(String vendorEmail, String vendorBusinessName,
                                String coupleName, String coupleEmail,
                                String weddingDate, String message,
                                String vendorProfileUrl);
    void sendVendorInquiryConfirmation(String coupleEmail, String coupleName,
                                       String vendorBusinessName, String vendorProfileUrl);
}
