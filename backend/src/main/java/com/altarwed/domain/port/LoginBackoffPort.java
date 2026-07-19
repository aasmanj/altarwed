package com.altarwed.domain.port;

/**
 * Per-account failed-login backoff for the credential login path (issue #249). The per-IP
 * {@code RateLimitingFilter} bucket caps attempts per source address, but an attacker who
 * distributes requests across IPs (or rotates X-Forwarded-For, issue #41) gets unlimited
 * password guesses against one known email. This tracker is keyed on the normalized target
 * email, the actual unit of a credential-stuffing attack, so it holds no matter how many
 * source addresses the attacker fans out over. It complements the IP limiter; it never
 * replaces or relaxes it.
 *
 * <p>Semantics: consecutive failures below a threshold are free (a real user mistyping a
 * password is never punished). At the threshold the key enters a cool-down; each further
 * failure after a cool-down expires escalates the next cool-down up to a hard cap. A short,
 * growing cool-down is deliberate, chosen over a long hard lockout: a hard lockout hands any
 * attacker who knows a victim's email a trivial denial-of-service (keep the account locked
 * forever with garbage passwords), while a capped backoff bounds the attacker to a handful of
 * guesses per window yet lets the legitimate owner in within minutes. Attempts REJECTED while
 * a key is cooling down are not charged as new failures for the same reason: charging them
 * would let an attacker extend a victim's cool-down indefinitely.
 *
 * <p>A successful login clears the key entirely. The key is tracked whether or not an account
 * exists for it, so a locked unknown email and a locked real account behave identically
 * (enumeration safety); callers must return the same response for both.
 *
 * <p>A plain domain port with no framework imports (hexagonal rule); the in-memory
 * implementation lives in infrastructure. Like every in-memory throttle in this codebase it is
 * per instance; issues #109/#414 track moving these stores to a shared Redis before scale-out
 * to multiple app instances.
 */
public interface LoginBackoffPort {

    /**
     * True when this key is currently cooling down and login attempts for it must be rejected
     * before any credential work. Peeks only; it never records anything, so checking cannot
     * itself push a key toward (or extend) a cool-down.
     *
     * @param emailKey the normalized (trimmed, lower-cased) target email, never the raw input
     */
    boolean isLockedOut(String emailKey);

    /**
     * Charges one failed login attempt against this key. Below the threshold this only counts;
     * at or beyond it, it starts the next (escalating) cool-down window.
     *
     * @param emailKey the normalized (trimmed, lower-cased) target email, never the raw input
     */
    void recordFailure(String emailKey);

    /**
     * Clears all failure state for this key after a successful login, so a legitimate user who
     * eventually remembered their password starts from a clean slate.
     *
     * @param emailKey the normalized (trimmed, lower-cased) target email, never the raw input
     */
    void recordSuccess(String emailKey);
}
