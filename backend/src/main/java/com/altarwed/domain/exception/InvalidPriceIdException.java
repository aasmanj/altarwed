package com.altarwed.domain.exception;

/**
 * Raised when a Stripe checkout request names a priceId outside the configured allow-list
 * (issue #45). A client error, not a server fault: it maps to 400 in GlobalExceptionHandler
 * and is never logged at ERROR. Prevents a vendor from opening a checkout session against an
 * arbitrary price in the Stripe account (wrong product, a test price, a $0 price).
 */
public class InvalidPriceIdException extends RuntimeException {
    public InvalidPriceIdException(String message) {
        super(message);
    }
}
