package com.altarwed.domain.port;

public interface EmailPort {
    void sendPasswordResetEmail(String toEmail, String resetToken);
}
