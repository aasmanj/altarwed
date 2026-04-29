package com.altarwed.domain.exception;

import java.util.UUID;

public class DenominationNotFoundException extends RuntimeException {

    public DenominationNotFoundException(UUID id) {
        super("Denomination not found with id: " + id);
    }

    public DenominationNotFoundException(String slug) {
        super("Denomination not found with slug: '" + slug + "'");
    }
}
