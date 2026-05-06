package com.altarwed.domain.exception;

public class WeddingPhotoNotFoundException extends RuntimeException {
    public WeddingPhotoNotFoundException(String id) {
        super("Wedding photo not found: " + id);
    }
}
