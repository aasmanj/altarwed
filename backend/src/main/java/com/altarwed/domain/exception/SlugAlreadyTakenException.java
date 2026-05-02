package com.altarwed.domain.exception;

public class SlugAlreadyTakenException extends RuntimeException {

    public SlugAlreadyTakenException(String slug) {
        super("The slug '" + slug + "' is already taken. Please choose a different one.");
    }
}
