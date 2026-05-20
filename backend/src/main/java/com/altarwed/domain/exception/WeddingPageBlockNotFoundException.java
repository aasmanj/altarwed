package com.altarwed.domain.exception;

public class WeddingPageBlockNotFoundException extends RuntimeException {
    public WeddingPageBlockNotFoundException(String identifier) {
        super("Wedding page block not found: " + identifier);
    }
}
