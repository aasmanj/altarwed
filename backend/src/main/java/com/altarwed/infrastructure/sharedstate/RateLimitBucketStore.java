package com.altarwed.infrastructure.sharedstate;

import io.github.bucket4j.BucketConfiguration;

import java.util.function.Supplier;

/**
 * The two token-bucket operations AltarWed's throttles actually need, hiding WHERE bucket
 * state lives: in this JVM ({@link InMemoryRateLimitBucketStore}, today's behavior) or in a
 * shared Redis ({@link RedisRateLimitBucketStore}), so per-IP and per-wedding limits stay
 * global once the App Service scales past one instance (issues #109/#414).
 *
 * <p>Deliberately narrower than handing out a raw Bucket4j {@code Bucket}: with only these two
 * methods, the Redis implementation can own the runtime failure policy (fail open, throttled
 * ERROR log) in one place instead of every consumer wrapping every bucket call, and consumers
 * cannot drift onto bucket operations the failure policy does not cover.
 *
 * <p>This is an infrastructure-level seam, not a domain port: rate limiting by client IP is an
 * HTTP-delivery concern with no domain meaning (contrast {@code RsvpSearchThrottlePort}, whose
 * per-wedding budget IS a domain rule and therefore lives in {@code domain.port}).
 */
public interface RateLimitBucketStore {

    /**
     * Consumes one token from the bucket for {@code key}, creating the bucket from
     * {@code configSupplier} on first use. True when the token was granted (request may
     * proceed), false when the bucket is empty (throttle).
     *
     * @param key            stable identity of the throttled subject, e.g. {@code "RSVP|203.0.113.7"}
     *                       or {@code "rsvp-search|<coupleId>"}; backends may namespace it further
     * @param configSupplier bandwidth (capacity + refill) applied when the bucket is first created
     */
    boolean tryConsume(String key, Supplier<BucketConfiguration> configSupplier);

    /**
     * Peeks at the tokens remaining for {@code key} without consuming any, creating the bucket
     * from {@code configSupplier} on first use ({@code <= 0} means locked out).
     */
    long availableTokens(String key, Supplier<BucketConfiguration> configSupplier);
}
