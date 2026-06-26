package com.altarwed.domain.exception;

/**
 * Raised when a vendor submits a promo code that does not match the configured comp code
 * (or when promo redemption is disabled because no code is configured). A client error, not a
 * server fault: it maps to 400 in GlobalExceptionHandler and is never logged at ERROR.
 */
public class InvalidPromoCodeException extends RuntimeException {
    public InvalidPromoCodeException(String message) {
        super(message);
    }
}
