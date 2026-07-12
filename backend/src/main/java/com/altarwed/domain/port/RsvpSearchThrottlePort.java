package com.altarwed.domain.port;

/**
 * Per-slug anti-enumeration throttle for the public "find your invitation" name search
 * (issue #89). The per-IP {@code RateLimitingFilter} bucket is trivially bypassed by rotating
 * X-Forwarded-For (issue #41), so it cannot stop a distributed guest-list enumeration of a
 * single wedding. This throttle is keyed on the wedding slug (the thing being enumerated), not
 * the caller IP, so it holds regardless of how many source addresses an attacker fans out over.
 *
 * Only zero-result ("failed") searches are counted: a guess that matches a real guest is not
 * enumeration, so a legitimate household that finds itself never trips (and clears) the lockout.
 * After a small threshold of failed searches within a window a slug enters a cooldown and further
 * searches are rejected until tokens refill.
 *
 * A plain domain port with no framework imports (hexagonal rule); the in-memory Bucket4j
 * implementation lives in infrastructure.
 */
public interface RsvpSearchThrottlePort {

    /**
     * True when this slug has exhausted its failed-search budget and is in cooldown. Peeks only;
     * it never consumes budget, so calling it does not itself push a slug toward lockout.
     */
    boolean isLockedOut(String slug);

    /** Records one zero-result ("failed") name search against this slug's budget. */
    void recordFailedAttempt(String slug);

    /**
     * Clears this slug's failed-search budget after a successful match, so a real guest finding
     * their invitation resets any accumulated failures for that wedding.
     */
    void clear(String slug);
}
