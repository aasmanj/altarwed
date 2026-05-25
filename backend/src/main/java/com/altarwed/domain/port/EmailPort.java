package com.altarwed.domain.port;

public interface EmailPort {
    void sendPasswordResetEmail(String toEmail, String resetToken);
    void sendRsvpInviteEmail(String toEmail, String guestName, String coupleNames, String weddingDate, String rsvpToken);
    void sendSaveTheDateEmail(String toEmail, String guestName, String coupleNames, String weddingDate, String weddingUrl);
    void sendRsvpNotificationToCouple(String coupleEmail, String coupleNames,
                                      String guestName, String rsvpStatus,
                                      String noteForCouple,
                                      String dashboardUrl);
}
