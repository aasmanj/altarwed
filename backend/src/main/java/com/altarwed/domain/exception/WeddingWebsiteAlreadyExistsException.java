package com.altarwed.domain.exception;

import java.util.UUID;

public class WeddingWebsiteAlreadyExistsException extends RuntimeException {
    public WeddingWebsiteAlreadyExistsException(UUID coupleId) {
        super("A wedding website already exists for couple: " + coupleId);
    }
}
