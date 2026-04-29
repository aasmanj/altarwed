package com.altarwed.domain.exception;

import java.util.UUID;

public class CoupleNotFoundException extends RuntimeException {

    public CoupleNotFoundException(UUID id) {
        super("Couple not found with id: " + id);
    }

    public CoupleNotFoundException(String email) {
        super("Couple not found with email: " + email);
    }
}
