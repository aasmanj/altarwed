package com.altarwed.infrastructure.sharedstate;

import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ClientSideConfig;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.ClientOptions;
import io.lettuce.core.RedisClient;
import io.lettuce.core.TimeoutOptions;
import io.lettuce.core.api.StatefulRedisConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Lettuce client wiring for the shared-state stores (issues #109/#414). The whole class is
 * gated on {@link RedisConfiguredCondition}: with {@code REDIS_URL} unset none of these beans
 * exist, no connection is attempted, and the app runs today's in-memory stores. With it set,
 * a startup failure to reach Redis is deliberately loud (fail fast on an explicitly configured
 * dependency) rather than a silent fallback that would leave rate limits per-instance without
 * anyone noticing.
 *
 * <p>Plain Lettuce, NOT spring-boot-starter-data-redis: the starter's autoconfiguration and
 * health indicator assume Redis is a core dependency, which would break the off-by-default
 * contract (health DOWN / noisy failures when Redis is absent). One client bean and one
 * connection bean are the entire integration surface.
 */
@Configuration
@Conditional(RedisConfiguredCondition.class)
public class RedisSharedStateConfig {

    private static final Logger log = LoggerFactory.getLogger(RedisSharedStateConfig.class);

    /**
     * One client per JVM (Lettuce's own recommendation; it multiplexes internally).
     * {@code destroyMethod = "shutdown"} releases its event-loop threads on context close so
     * graceful shutdown (server.shutdown=graceful) is not held up.
     */
    @Bean(destroyMethod = "shutdown")
    public RedisClient sharedStateRedisClient(@Value("${altarwed.redis.url}") String redisUrl) {
        // The URL embeds the access key, so it must never be logged (observability rule 8);
        // log only the fact that shared state is Redis-backed.
        log.info("shared state redis enabled, rate limits, rsvp throttle and oauth state are cross-instance");
        RedisClient client = RedisClient.create(redisUrl);
        client.setOptions(resilientClientOptions());
        return client;
    }

    /**
     * Bounds how long a mid-outage Redis command can hold up a request. Lettuce's defaults
     * (60 second command timeout, buffer commands while disconnected) would make every
     * rate-limited request hang for up to a minute during a Redis outage before the store
     * could fail open. REJECT_COMMANDS fails calls immediately once the connection is known
     * dead, and the 2 second command timeout caps the stall when it is not yet known.
     * Package-visible so the fail-open test exercises the exact production options.
     */
    static ClientOptions resilientClientOptions() {
        return ClientOptions.builder()
                .disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
                .timeoutOptions(TimeoutOptions.enabled(Duration.ofSeconds(2)))
                .build();
    }

    /**
     * Single shared connection for the plain key-value adapters (OAuth state). Lettuce
     * connections are thread-safe and pipelined, so one is correct here; the bucket
     * ProxyManager below manages its own connection internally.
     */
    @Bean(destroyMethod = "close")
    public StatefulRedisConnection<String, String> sharedStateRedisConnection(RedisClient client) {
        return client.connect();
    }

    /**
     * Bucket4j's Redis-backed bucket factory (compare-and-swap over Lettuce). The expiration
     * strategy derives each Redis key's TTL from that bucket's own time-to-full-refill plus a
     * one-minute grace, mirroring the in-memory rule that a bucket must never evict (and so
     * silently refill) mid-throttle, while still guaranteeing idle keys are reclaimed. One
     * proxy manager serves every bucket consumer regardless of its refill window.
     */
    @Bean
    public LettuceBasedProxyManager<byte[]> sharedStateBucketProxyManager(RedisClient client) {
        // withClientSideConfig is the non-deprecated home of the expiration strategy in
        // Bucket4j 8.10 (withExpirationStrategy is deprecated in favor of it).
        return LettuceBasedProxyManager.builderFor(client)
                .withClientSideConfig(ClientSideConfig.getDefault()
                        .withExpirationAfterWriteStrategy(
                                ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(Duration.ofMinutes(1))))
                .build();
    }
}
