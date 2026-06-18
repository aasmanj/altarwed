package com.altarwed.domain.port;

import com.altarwed.domain.model.EmailRecipient;

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
    void sendRsvpInviteEmail(String toEmail, String guestName, String coupleNames, String weddingDate,
                             String rsvpToken, UUID guestId, UUID coupleId);

    // Bulk save-the-date send. Implementations fan the recipients out through the
    // provider's batch API so a 200-guest send is a couple of API calls rather than
    // 200, instead of tripping the per-second rate limit. Shared fields (coupleNames,
    // weddingDate, weddingUrl, stdImageUrl) are identical for every recipient; coupleId
    // and each recipient's guestId tag the message for delivery-webhook mapping.
    void sendSaveTheDateEmails(List<EmailRecipient> recipients, UUID coupleId, String coupleNames,
                               String weddingDate, String weddingUrl, String stdImageUrl);
    void sendRsvpNotificationToCouple(String coupleEmail, String coupleNames,
                                      String guestName, String rsvpStatus,
                                      String noteForCouple,
                                      String dashboardUrl);

    // Internal admin alert, sent to the platform owner when a new vendor registers
    // so they can review the listing and unverify bad actors.
    void sendVendorRegistrationAlert(String businessName, String category,
                                     String city, String state, String vendorEmail,
                                     String vendorId, String adminListingUrl);

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
