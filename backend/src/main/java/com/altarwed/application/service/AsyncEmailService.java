package com.altarwed.application.service;

import com.altarwed.domain.port.EmailPort;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

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
                                    String coupleNames, String weddingDate, String rsvpToken) {
        emailPort.sendRsvpInviteEmail(toEmail, guestName, coupleNames, weddingDate, rsvpToken);
    }

    @Async("emailExecutor")
    public void sendSaveTheDateEmail(String toEmail, String guestName,
                                     String coupleNames, String weddingDate, String weddingUrl) {
        emailPort.sendSaveTheDateEmail(toEmail, guestName, coupleNames, weddingDate, weddingUrl);
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
                                              String dashboardUrl) {
        emailPort.sendRsvpNotificationToCouple(coupleEmail, coupleNames, guestName,
                rsvpStatus, noteForCouple, dashboardUrl);
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
                                             String vendorId, String adminListingUrl) {
        emailPort.sendVendorRegistrationAlert(businessName, category,
                city, state, vendorEmail, vendorId, adminListingUrl);
    }
}
