package com.altarwed.domain.exception;

public class GuestNotFoundException extends RuntimeException {
    public GuestNotFoundException(String id) {
        super("Guest not found: " + id);
    }
}
