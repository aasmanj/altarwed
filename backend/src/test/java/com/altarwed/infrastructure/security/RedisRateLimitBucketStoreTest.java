package com.altarwed.infrastructure.security;

import com.altarwed.infrastructure.sharedstate.RedisRateLimitBucketStore;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ClientSideConfig;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.RedisClient;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Proves the Redis bucket store gives the {@code RateLimitingFilter} the property issue #109
 * needs: bucket state shared across store instances (i.e. across App Service instances), with
 * the filter's observable behavior otherwise identical to the in-memory tests in
 * {@code RateLimitingFilterTest}. Runs against a real Redis via Testcontainers;
 * {@code disabledWithoutDocker = true} skips (not fails) where no Docker socket exists, and CI
 * always runs it. The runtime failure policy is covered separately in
 * {@code RedisRateLimitBucketStoreFailOpenTest} (it needs a container it can kill).
 */
@Testcontainers(disabledWithoutDocker = true)
class RedisRateLimitBucketStoreTest {

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    private static RedisClient clientA;
    private static RedisClient clientB;
    private static RedisRateLimitBucketStore storeA;
    private static RedisRateLimitBucketStore storeB;

    @BeforeAll
    static void connect() {
        String url = "redis://" + REDIS.getHost() + ":" + REDIS.getMappedPort(6379);
        // Two clients + two stores simulate two separate JVMs sharing one Redis.
        clientA = RedisClient.create(url);
        clientB = RedisClient.create(url);
        storeA = new RedisRateLimitBucketStore(proxyManager(clientA));
        storeB = new RedisRateLimitBucketStore(proxyManager(clientB));
    }

    @AfterAll
    static void shutdown() {
        clientA.shutdown();
        clientB.shutdown();
    }

    // Same settings as RedisSharedStateConfig so the test exercises the production wiring.
    private static LettuceBasedProxyManager<byte[]> proxyManager(RedisClient client) {
        return LettuceBasedProxyManager.builderFor(client)
                .withClientSideConfig(ClientSideConfig.getDefault()
                        .withExpirationAfterWriteStrategy(
                                ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(Duration.ofMinutes(1))))
                .build();
    }

    // The DEFAULT tier's shape: burst capacity 10, steady refill 5 per minute.
    private static Supplier<BucketConfiguration> burstTenRefillFivePerMinute() {
        return () -> BucketConfiguration.builder()
                .addLimit(Bandwidth.builder().capacity(10).refillGreedy(5, Duration.ofMinutes(1)).build())
                .build();
    }

    @Test
    void bucketStateIsSharedAcrossStoreInstances() {
        // The core #109 property: tokens consumed through "instance A" are gone when the same
        // key is resolved through "instance B", so scaling out cannot multiply the limit.
        String key = "shared-" + UUID.randomUUID();

        for (int i = 0; i < 10; i++) {
            assertThat(storeA.tryConsume(key, burstTenRefillFivePerMinute()))
                    .as("token %d of the 10-token burst", i + 1).isTrue();
        }

        assertThat(storeB.tryConsume(key, burstTenRefillFivePerMinute()))
                .as("11th token via another instance must be rejected").isFalse();
        assertThat(storeB.availableTokens(key, burstTenRefillFivePerMinute())).isLessThanOrEqualTo(0);
    }

    @Test
    void filterThrottlesIdenticallyOverRedis() throws Exception {
        // The same black-box behavior RateLimitingFilterTest proves in-memory: the DEFAULT
        // tier allows exactly its 10-token burst per client IP, then 429s. One filter per
        // "instance", both backed by the shared Redis, hit alternately as a round-robin load
        // balancer would; in-memory each filter would allow 10 (20 total, the #109 bug).
        RateLimitingFilter filterA = new RateLimitingFilter(storeA);
        RateLimitingFilter filterB = new RateLimitingFilter(storeB);
        FilterChain chain = mock(FilterChain.class);
        // Fixed IP is safe: the container (and so all bucket state) is fresh per class run,
        // and no other test in this class touches the DEFAULT|ip key space.
        String ip = "203.0.113.77";

        int allowed = 0;
        int throttled = 0;
        for (int i = 0; i < 12; i++) {
            MockHttpServletRequest request =
                    new MockHttpServletRequest("GET", "/api/v1/guests/rsvp/find");
            request.addHeader("X-Forwarded-For", ip + ":" + (50000 + i));
            MockHttpServletResponse response = new MockHttpServletResponse();
            (i % 2 == 0 ? filterA : filterB).doFilterInternal(request, response, chain);
            if (response.getStatus() == 200) allowed++; else throttled++;
        }

        assertThat(allowed).isEqualTo(10);
        assertThat(throttled).isEqualTo(2);
    }
}
