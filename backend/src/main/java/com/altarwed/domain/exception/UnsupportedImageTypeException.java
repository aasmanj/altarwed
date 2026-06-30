package com.altarwed.domain.exception;

// Thrown when an upload's image type (checked both by declared Content-Type and magic-byte sniff)
// is not on the allowed list. Distinct from IllegalArgumentException so the web layer maps it to
// 415 Unsupported Media Type without string-matching the message.
public class UnsupportedImageTypeException extends RuntimeException {
    public UnsupportedImageTypeException(String message) {
        super(message);
    }
}
