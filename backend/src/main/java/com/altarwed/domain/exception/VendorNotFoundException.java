package com.altarwed.domain.exception;

import java.util.UUID;

public class VendorNotFoundException extends RuntimeException {

    public VendorNotFoundException(UUID id) {
        super("Vendor not found with id: " + id);
    }

    public VendorNotFoundException(String email) {
        super("Vendor not found with email: " + email);
    }
}
