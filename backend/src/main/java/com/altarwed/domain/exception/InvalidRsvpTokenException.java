package com.altarwed.domain.exception;

public class InvalidRsvpTokenException extends RuntimeException {
    public InvalidRsvpTokenException() {
        super("RSVP token is invalid or expired");
    }
}
