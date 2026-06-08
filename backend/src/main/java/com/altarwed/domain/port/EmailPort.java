package com.altarwed.domain.port;

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

    void sendRsvpInviteEmail(String toEmail, String guestName, String coupleNames, String weddingDate, String rsvpToken);
    void sendSaveTheDateEmail(String toEmail, String guestName, String coupleNames, String weddingDate, String weddingUrl);
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
