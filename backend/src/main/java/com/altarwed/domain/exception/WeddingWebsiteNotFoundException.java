package com.altarwed.domain.exception;

import java.util.UUID;

public class WeddingWebsiteNotFoundException extends RuntimeException {

    public WeddingWebsiteNotFoundException(UUID id) {
        super("Wedding website not found with id: " + id);
    }

    public WeddingWebsiteNotFoundException(String slug) {
        super("Wedding website not found with slug: " + slug);
    }
}
