package com.altarwed.infrastructure.sharedstate;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.RedisException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * Redis-backed bucket store (issues #109/#414): bucket state lives in the shared Redis, so a
 * limit spent on instance A is spent on instance B too. Each operation is a compare-and-swap
 * round trip to Redis.
 *
 * <p><strong>Runtime failure policy: fail open.</strong> A Redis blip must not turn every
 * login, RSVP, and inquiry into a 500: these buckets are abuse throttles, not authorization,
 * so availability of the guarded endpoints beats throttle strictness for the duration of an
 * infrastructure incident (an attacker cannot trigger a Redis outage from the outside; if
 * Redis is down we have a bigger, already-alerting problem). While failing open, an ERROR is
 * logged at most once per minute per instance: enough for App Insights to alert that limits
 * are unenforced, without a per-request log flood during the outage (observability rule 9).
 * Startup remains fail-fast: an unreachable Redis at boot with REDIS_URL set fails loudly in
 * {@link RedisSharedStateConfig} rather than silently degrading to per-instance limits.
 *
 * <p>Eviction moves from Caffeine to Redis TTLs: the proxy manager's expiration strategy (see
 * {@link RedisSharedStateConfig}) gives every key a TTL of its own time-to-full-refill plus
 * grace, preserving the "never evict mid-throttle" invariant of the in-memory store.
 *
 * <p>Keys are namespaced under {@code altarwed:rl:} so throttle state can never collide with
 * any other current or future use of the same Redis (and is easy to inspect/flush surgically).
 */
@Component
@Conditional(RedisConfiguredCondition.class)
public class RedisRateLimitBucketStore implements RateLimitBucketStore {

    private static final Logger log = LoggerFactory.getLogger(RedisRateLimitBucketStore.class);

    private static final String KEY_PREFIX = "altarwed:rl:";
    private static final long FAILURE_LOG_INTERVAL_MS = 60_000;

    private final LettuceBasedProxyManager<byte[]> proxyManager;

    // Epoch millis of the last fail-open ERROR line, for the once-per-minute cap above.
    private final AtomicLong lastFailureLogMs = new AtomicLong(0);

    public RedisRateLimitBucketStore(LettuceBasedProxyManager<byte[]> proxyManager) {
        this.proxyManager = proxyManager;
    }

    @Override
    public boolean tryConsume(String key, Supplier<BucketConfiguration> configSupplier) {
        try {
            return bucket(key, configSupplier).tryConsume(1);
        } catch (RedisException ex) {
            logFailingOpen(ex);
            return true;
        }
    }

    @Override
    public long availableTokens(String key, Supplier<BucketConfiguration> configSupplier) {
        try {
            return bucket(key, configSupplier).getAvailableTokens();
        } catch (RedisException ex) {
            logFailingOpen(ex);
            // A positive count reads as "not locked out" to every caller: fail open.
            return 1;
        }
    }

    private Bucket bucket(String key, Supplier<BucketConfiguration> configSupplier) {
        byte[] redisKey = (KEY_PREFIX + key).getBytes(StandardCharsets.UTF_8);
        // The supplier form defers config construction to first creation of the remote bucket;
        // an existing key keeps its persisted configuration.
        return proxyManager.builder().build(redisKey, configSupplier);
    }

    private void logFailingOpen(RedisException ex) {
        long now = System.currentTimeMillis();
        long last = lastFailureLogMs.get();
        // compareAndSet so concurrent requests during an outage elect exactly one logger per
        // interval instead of all racing through the time check.
        if (now - last >= FAILURE_LOG_INTERVAL_MS && lastFailureLogMs.compareAndSet(last, now)) {
            log.error("rate limit redis unavailable, failing open, limits unenforced until redis recovers", ex);
        }
    }
}
