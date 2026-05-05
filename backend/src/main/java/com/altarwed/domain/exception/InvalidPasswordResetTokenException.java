package com.altarwed.domain.exception;

public class InvalidPasswordResetTokenException extends RuntimeException {
    public InvalidPasswordResetTokenException() {
        super("Password reset token is invalid or has expired");
    }
}
