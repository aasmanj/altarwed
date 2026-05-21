package com.altarwed.domain.exception;

public class WeddingHotelNotFoundException extends RuntimeException {
    public WeddingHotelNotFoundException(String id) {
        super("Wedding hotel not found: " + id);
    }
}
