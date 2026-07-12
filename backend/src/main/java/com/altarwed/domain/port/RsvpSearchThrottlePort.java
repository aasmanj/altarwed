package com.altarwed.domain.port;

/**
 * Per-wedding anti-enumeration throttle for the public "find your invitation" name search
 * (issue #89). The per-IP {@code RateLimitingFilter} bucket is trivially bypassed by rotating
 * X-Forwarded-For (issue #41), so it cannot stop a distributed guest-list enumeration of a
 * single wedding. This throttle is keyed on the wedding's canonical identity (the couple id, not
 * the caller-supplied slug string), so it holds regardless of how many source addresses an
 * attacker fans out over AND regardless of how they case or pad the slug.
 *
 * <p>EVERY find attempt is charged against the budget, success or failure. An earlier design only
 * counted zero-result searches and reset the budget on any match, but the find endpoint's match is
 * a case-insensitive SUBSTRING lookup that returns up to five masked names plus live RSVP tokens:
 * an attacker dictionary-walking common name fragments harvested unthrottled, and any single hit
 * reset the budget. Counting every attempt and never resetting closes that harvest path: the
 * budget bounds total lookups per wedding per window, whether they hit or miss.
 *
 * <p>A plain domain port with no framework imports (hexagonal rule); the in-memory Bucket4j
 * implementation lives in infrastructure.
 */
public interface RsvpSearchThrottlePort {

    /**
     * True when this wedding key has exhausted its find budget and is in cooldown. Peeks only;
     * it never consumes budget, so calling it does not itself push a key toward lockout. Call
     * this before charging {@link #recordAttempt(String)}, so a locked-out wedding is rejected
     * without doing any further work.
     *
     * @param key the wedding's canonical identity (couple id string), never the raw request slug
     */
    boolean isLockedOut(String key);

    /**
     * Charges one find attempt against this wedding's budget, regardless of whether the search
     * matched a guest. There is deliberately no reset-on-success: every lookup, hit or miss,
     * consumes exactly one token, so the harvest path (successful substring matches that each
     * return masked names + live tokens) is bounded, not exempt.
     *
     * @param key the wedding's canonical identity (couple id string), never the raw request slug
     */
    void recordAttempt(String key);
}
