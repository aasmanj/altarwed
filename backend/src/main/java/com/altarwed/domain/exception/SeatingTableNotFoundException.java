package com.altarwed.domain.exception;

public class SeatingTableNotFoundException extends RuntimeException {
    public SeatingTableNotFoundException(String id) {
        super("Seating table not found: " + id);
    }
}
