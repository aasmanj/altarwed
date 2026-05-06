package com.altarwed.domain.exception;

public class WeddingPrayerNotFoundException extends RuntimeException {
    public WeddingPrayerNotFoundException(String id) {
        super("Prayer not found: " + id);
    }
}
