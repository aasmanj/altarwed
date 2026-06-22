package com.altarwed.domain.exception;

public class CustomQuestionNotFoundException extends RuntimeException {
    public CustomQuestionNotFoundException(String id) {
        super("Custom RSVP question not found: " + id);
    }
}
