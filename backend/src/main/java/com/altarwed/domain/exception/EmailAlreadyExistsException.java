package com.altarwed.domain.exception;

public class EmailAlreadyExistsException extends RuntimeException {

    // Never embed the submitted email in the message. It is attacker-controlled
    // input (reflection/injection sink for any non-React consumer of the error
    // detail) and PII that would leak into logs via ex.getMessage(). The client
    // already knows which email it submitted, so reflecting it adds nothing.
    public EmailAlreadyExistsException(String email) {
        super("An account with this email already exists");
    }
}
