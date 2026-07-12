package com.altarwed.domain.exception;

/**
 * Thrown when the public find-invitation search for a wedding has exceeded its per-wedding
 * attempt budget and is in cooldown (issue #89). Every attempt is charged (hit or miss), keyed
 * on the canonical wedding identity (coupleId), not the caller-supplied slug. Surfaced as HTTP
 * 429 by the GlobalExceptionHandler, mirroring the per-IP rate-limit response from RateLimitingFilter.
 */
public class RsvpSearchThrottledException extends RuntimeException {
    public RsvpSearchThrottledException() {
        super("Too many invitation lookups for this wedding. Please wait a few minutes and try again.");
    }
}
