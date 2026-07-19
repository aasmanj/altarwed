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
 * <p>A plain domain port with no framework imports (hexagonal rule); the Bucket4j
 * implementations (in-memory by default, Redis when REDIS_URL is set, issue #414) live in
 * infrastructure.
 */
public interface RsvpSearchThrottlePort {

    /**
     * Total find attempts (hit or miss) allowed for one wedding within {@link #REFILL_WINDOW}
     * before it enters cooldown. The budget is business policy, not an adapter detail, so it
     * lives on the port: every adapter must enforce the same number or the throttle's strength
     * would silently depend on which storage backend is configured.
     *
     * <p>Raised from 20 to 40 for issue #415 to widen legit-guest headroom: the budget is keyed
     * PER WEDDING, so right after an invite blast a crowd of legitimate guests share one bucket
     * and must not collectively trip a 429. Raising it does not reopen the #89 harvest hole,
     * because two stronger controls now sit in front of this throttle: every find attempt must
     * first pass a Turnstile captcha, and a SEARCH-sourced token view discloses only the guessed
     * guest plus a masked, status-less household roster (issue #415). The throttle is therefore a
     * volume backstop, not the primary anti-enumeration control. Deferred idea: a per-wedding
     * distinct-name cap (would need this port's signature to carry the query) so enumeration is
     * penalized harder than a legit guest's repeated self-lookup.
     */
    int SEARCH_BUDGET = 40;

    /**
     * The budget refills fully over this window (greedily, so partial refill accrues
     * continuously; a drained wedding gets roughly one lookup per
     * {@code REFILL_WINDOW / SEARCH_BUDGET} rather than a hard ban).
     */
    java.time.Duration REFILL_WINDOW = java.time.Duration.ofMinutes(10);

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
