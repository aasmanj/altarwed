package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.RsvpSearchThrottlePort;
import com.altarwed.infrastructure.sharedstate.RedisRateLimitBucketStore;
import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ClientSideConfig;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import io.lettuce.core.RedisClient;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs the {@link RsvpSearchThrottleContractTest} contract against the Redis adapter over a
 * real Redis (Testcontainers), plus the one property the in-memory adapter cannot have and the
 * whole of issue #414 exists for: two adapter instances (two "App Service instances") share
 * one budget and one lockout.
 *
 * <p>{@code disabledWithoutDocker = true}: on a machine with no Docker socket these tests are
 * skipped, not failed; CI (ubuntu-latest, Docker available) always runs them.
 */
@Testcontainers(disabledWithoutDocker = true)
class RedisRsvpSearchThrottleAdapterTest extends RsvpSearchThrottleContractTest {

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    private static RedisClient client;
    private static RedisRsvpSearchThrottleAdapter adapter;

    @BeforeAll
    static void connect() {
        client = RedisClient.create("redis://" + REDIS.getHost() + ":" + REDIS.getMappedPort(6379));
        adapter = new RedisRsvpSearchThrottleAdapter(new RedisRateLimitBucketStore(proxyManager(client)));
    }

    @AfterAll
    static void shutdown() {
        client.shutdown();
    }

    // Same proxy-manager settings as RedisSharedStateConfig, so the contract runs against the
    // production wiring, not a test-only variant.
    private static LettuceBasedProxyManager<byte[]> proxyManager(RedisClient client) {
        return LettuceBasedProxyManager.builderFor(client)
                .withClientSideConfig(ClientSideConfig.getDefault()
                        .withExpirationAfterWriteStrategy(
                                ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(Duration.ofMinutes(1))))
                .build();
    }

    @Override
    RsvpSearchThrottlePort throttle() {
        return adapter;
    }

    @Test
    void budgetAndLockoutAreSharedAcrossAdapterInstances() {
        // Two adapters over two independent client connections = two backend instances behind
        // the load balancer. In-memory, each instance would grant a fresh budget (the #414
        // bug); over Redis the budget must be global and the lockout visible everywhere.
        RedisClient otherClient =
                RedisClient.create("redis://" + REDIS.getHost() + ":" + REDIS.getMappedPort(6379));
        try {
            RsvpSearchThrottlePort instanceA = adapter;
            RsvpSearchThrottlePort instanceB = new RedisRsvpSearchThrottleAdapter(
                    new RedisRateLimitBucketStore(proxyManager(otherClient)));
            String weddingKey = "shared-" + UUID.randomUUID();

            // Round-robin the attempts across both instances, as a load balancer would.
            for (int i = 0; i < BUDGET; i++) {
                (i % 2 == 0 ? instanceA : instanceB).recordAttempt(weddingKey);
            }

            assertThat(instanceA.isLockedOut(weddingKey)).isTrue();
            assertThat(instanceB.isLockedOut(weddingKey)).isTrue();
        } finally {
            otherClient.shutdown();
        }
    }
}
