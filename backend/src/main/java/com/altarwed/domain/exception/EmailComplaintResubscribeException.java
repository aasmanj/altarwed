package com.altarwed.domain.exception;

/**
 * Thrown when a couple tries to resubscribe a guest whose email was suppressed
 * because of a spam complaint. We never auto-reverse a complaint (it would damage
 * the shared sending-domain reputation), so this maps to a 422 with guidance rather
 * than silently failing or silently succeeding.
 */
public class EmailComplaintResubscribeException extends RuntimeException {
    public EmailComplaintResubscribeException(String message) {
        super(message);
    }
}
