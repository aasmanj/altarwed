package com.altarwed.domain.exception;

/**
 * Thrown when the public find-invitation search for a given wedding slug has exceeded its
 * failed-search budget and is in cooldown (issue #89). Surfaced as HTTP 429 by the
 * GlobalExceptionHandler, mirroring the per-IP rate-limit response written by RateLimitingFilter.
 */
public class RsvpSearchThrottledException extends RuntimeException {
    public RsvpSearchThrottledException() {
        super("Too many invitation lookups for this wedding. Please wait a few minutes and try again.");
    }
}
