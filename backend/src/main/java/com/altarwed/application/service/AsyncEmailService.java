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
}
