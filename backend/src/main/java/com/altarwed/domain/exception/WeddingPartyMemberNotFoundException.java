package com.altarwed.domain.exception;

public class WeddingPartyMemberNotFoundException extends RuntimeException {
    public WeddingPartyMemberNotFoundException(String id) {
        super("Wedding party member not found: " + id);
    }
}
