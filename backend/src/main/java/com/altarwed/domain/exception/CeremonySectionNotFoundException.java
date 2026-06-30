package com.altarwed.domain.exception;

public class CeremonySectionNotFoundException extends RuntimeException {
    public CeremonySectionNotFoundException(String id) {
        super("Ceremony section not found: " + id);
    }
}
