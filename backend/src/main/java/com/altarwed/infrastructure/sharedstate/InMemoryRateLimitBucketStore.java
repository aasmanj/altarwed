package com.altarwed.infrastructure.sharedstate;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.local.LocalBucketBuilder;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.function.Supplier;

/**
 * Default, per-JVM bucket store; byte-for-byte the storage {@code RateLimitingFilter} used
 * before issue #109 extracted it behind {@link RateLimitBucketStore}, so with no
 * {@code REDIS_URL} configured behavior is exactly what shipped: same Caffeine bounds, same
 * TTL, same local Bucket4j buckets.
 *
 * <p>Bounded + TTL-evicting (issue #41): an unbounded map keyed by client IP is an OOM/DoS
 * vector on its own. 10 minutes is comfortably longer than every consumer's refill window
 * (1 minute for the IP tiers), so a bucket never evicts mid-throttle; maximumSize is a hard
 * backstop against a single burst of unique keys outrunning eviction.
 *
 * <p>Per instance by design: on N instances each key effectively gets N buckets. Acceptable at
 * capacity 1; {@code SharedStateStartupLogger} warns in prod until Redis takes over.
 */
@Component
@Conditional(RedisNotConfiguredCondition.class)
public class InMemoryRateLimitBucketStore implements RateLimitBucketStore {

    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000)
            .expireAfterAccess(Duration.ofMinutes(10))
            .build();

    @Override
    public boolean tryConsume(String key, Supplier<BucketConfiguration> configSupplier) {
        return bucket(key, configSupplier).tryConsume(1);
    }

    @Override
    public long availableTokens(String key, Supplier<BucketConfiguration> configSupplier) {
        return bucket(key, configSupplier).getAvailableTokens();
    }

    private Bucket bucket(String key, Supplier<BucketConfiguration> configSupplier) {
        return buckets.get(key, k -> localBucket(configSupplier.get()));
    }

    // Builds a plain in-process bucket from the backend-neutral BucketConfiguration (the
    // shape the Redis store needs), keeping both stores on one config type.
    private static Bucket localBucket(BucketConfiguration configuration) {
        LocalBucketBuilder builder = Bucket.builder();
        for (Bandwidth bandwidth : configuration.getBandwidths()) {
            builder.addLimit(bandwidth);
        }
        return builder.build();
    }
}
