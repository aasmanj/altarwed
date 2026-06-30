package com.altarwed.application.service;

import com.altarwed.domain.model.EmailRecipient;
import com.altarwed.domain.port.EmailPort;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Thin async wrapper around EmailPort.
 * Spring's @Async proxy only intercepts calls made from OTHER beans, so
 * GuestService must inject this class rather than calling EmailPort directly
 * to get true background execution.
 */
@Service
public class AsyncEmailService {

    private final EmailPort emailPort;

    public AsyncEmailService(EmailPort emailPort) {
        this.emailPort = emailPort;
    }

    @Async("emailExecutor")
    public void sendRsvpInviteEmail(String toEmail, String guestName,
                                    String coupleNames, String weddingDate, String rsvpToken,
                                    UUID guestId, UUID coupleId, String coupleReplyToEmail) {
        emailPort.sendRsvpInviteEmail(toEmail, guestName, coupleNames, weddingDate, rsvpToken,
                guestId, coupleId, coupleReplyToEmail);
    }

    // One background task fans the whole guest list into batched provider calls,
    // rather than queueing one async task (and one API call) per recipient.
    @Async("emailExecutor")
    public void sendSaveTheDateEmails(List<EmailRecipient> recipients, UUID coupleId, String coupleNames,
                                      String weddingDate, String weddingUrl, String stdImageUrl,
                                      String coupleReplyToEmail) {
        emailPort.sendSaveTheDateEmails(recipients, coupleId, coupleNames, weddingDate, weddingUrl,
                stdImageUrl, coupleReplyToEmail);
    }

    @Async("emailExecutor")
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        emailPort.sendPasswordResetEmail(toEmail, resetToken);
    }

    @Async("emailExecutor")
    public void sendWelcomeEmail(String toEmail, String partnerOneName, String partnerTwoName) {
        emailPort.sendWelcomeEmail(toEmail, partnerOneName, partnerTwoName);
    }

    @Async("emailExecutor")
    public void sendAccountDeletedEmail(String toEmail, String partnerOneName, String partnerTwoName) {
        emailPort.sendAccountDeletedEmail(toEmail, partnerOneName, partnerTwoName);
    }

    @Async("emailExecutor")
    public void sendRsvpNotificationToCouple(String coupleEmail, String coupleNames,
                                              String guestName, String rsvpStatus,
                                              String noteForCouple,
                                              String dashboardUrl,
                                              String guestReplyToEmail) {
        emailPort.sendRsvpNotificationToCouple(coupleEmail, coupleNames, guestName,
                rsvpStatus, noteForCouple, dashboardUrl, guestReplyToEmail);
    }

    @Async("emailExecutor")
    public void sendVendorInquiryEmail(String vendorEmail, String vendorBusinessName,
                                        String coupleName, String coupleEmail,
                                        String weddingDate, String message,
                                        String vendorProfileUrl) {
        emailPort.sendVendorInquiryEmail(vendorEmail, vendorBusinessName,
                coupleName, coupleEmail, weddingDate, message, vendorProfileUrl);
    }

    @Async("emailExecutor")
    public void sendVendorInquiryConfirmation(String coupleEmail, String coupleName,
                                               String vendorBusinessName, String vendorProfileUrl) {
        emailPort.sendVendorInquiryConfirmation(coupleEmail, coupleName,
                vendorBusinessName, vendorProfileUrl);
    }

    @Async("emailExecutor")
    public void sendVendorRegistrationAlert(String businessName, String category,
                                             String city, String state, String vendorEmail,
                                             String vendorId, String adminListingUrl,
                                             boolean autoVerified) {
        emailPort.sendVendorRegistrationAlert(businessName, category,
                city, state, vendorEmail, vendorId, adminListingUrl, autoVerified);
    }

    @Async("emailExecutor")
    public void sendWeddingPublishedEmail(String toEmail, String partnerOneName,
                                          String partnerTwoName, String weddingUrl) {
        emailPort.sendWeddingPublishedEmail(toEmail, partnerOneName, partnerTwoName, weddingUrl);
    }

    @Async("emailExecutor")
    public void sendCoupleWebsiteCreatedAlert(String coupleEmail, String partnerOneName,
                                               String partnerTwoName, String slug, String siteUrl) {
        emailPort.sendCoupleWebsiteCreatedAlert(coupleEmail, partnerOneName, partnerTwoName, slug, siteUrl);
    }

    @Async("emailExecutor")
    public void sendVendorWelcomeEmail(String toEmail, String businessName,
                                       String listingUrl, String dashboardUrl,
                                       boolean isFoundingVendor) {
        emailPort.sendVendorWelcomeEmail(toEmail, businessName, listingUrl, dashboardUrl, isFoundingVendor);
    }

    @Async("emailExecutor")
    public void sendVendorVerifiedEmail(String toEmail, String businessName,
                                        String listingUrl, String dashboardUrl) {
        emailPort.sendVendorVerifiedEmail(toEmail, businessName, listingUrl, dashboardUrl);
    }
}
