package com.altarwed.domain.port;

/**
 * Per-vendor inbound send cap for the public vendor inquiry endpoint (issue #100).
 * POST /api/v1/inquiries is unauthenticated and queues two emails per accepted call
 * (vendor notification + couple confirmation), so it is an email-flood vector against
 * a vendor's inbox and against our sender reputation. The per-IP RateLimitingFilter
 * bucket is bypassable by rotating X-Forwarded-For (issue #41), so it cannot stop a
 * distributed flood aimed at one vendor. This throttle is keyed on the target
 * vendor's canonical identity (vendor id string), so it holds regardless of how many
 * source addresses an attacker fans out over.
 *
 * <p>The budget is charged only for inquiries that have already passed captcha
 * verification and resolved to an active vendor: a failed captcha or an invalid
 * vendor id must not let an attacker burn a real vendor's inbound budget and lock
 * legitimate couples out (a denial-of-service inversion).
 *
 * <p>A plain domain port with no framework imports (hexagonal rule); the in-memory
 * Bucket4j implementation lives in infrastructure. In-memory is per instance; the
 * Redis-backed shared store for all rate limits is tracked in issue #109.
 */
public interface InquiryThrottlePort {

    /**
     * Attempts to charge one inquiry against this vendor's rolling inbound budget.
     *
     * @param vendorKey the target vendor's canonical identity (vendor id string),
     *                  never caller-supplied free text
     * @return true when the inquiry is within budget and has been charged; false when
     *         the vendor's budget is exhausted and the inquiry must be rejected
     *         without persisting or sending any email
     */
    boolean tryAcquire(String vendorKey);
}
