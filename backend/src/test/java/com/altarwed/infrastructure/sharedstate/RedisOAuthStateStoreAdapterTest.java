package com.altarwed.infrastructure.sharedstate;

import com.altarwed.domain.port.OAuthStateStorePort;
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
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
 * Runs the {@link OAuthStateStoreContractTest} contract against the Redis adapter over a real
 * Redis (Testcontainers), plus TTL expiry (delegated to Redis itself via PSETEX) and the
 * cross-instance property issue #109 exists for: a state issued through one connection is
 * consumable through another, exactly once.
 *
 * <p>{@code disabledWithoutDocker = true}: skipped, not failed, where no Docker socket exists;
 * CI always runs these.
 */
@Testcontainers(disabledWithoutDocker = true)
class RedisOAuthStateStoreAdapterTest extends OAuthStateStoreContractTest {

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    private static RedisClient client;
    private static StatefulRedisConnection<String, String> connection;
    private static RedisOAuthStateStoreAdapter adapter;

    @BeforeAll
    static void connect() {
        client = RedisClient.create("redis://" + REDIS.getHost() + ":" + REDIS.getMappedPort(6379));
        connection = client.connect();
        adapter = new RedisOAuthStateStoreAdapter(connection);
    }

    @AfterAll
    static void shutdown() {
        connection.close();
        client.shutdown();
    }

    @Override
    OAuthStateStorePort store() {
        return adapter;
    }

    @Test
    void expiredStateComesBackEmpty() throws InterruptedException {
        adapter.store("expiring-state", UUID.randomUUID(), Duration.ofMillis(100));

        // Real time must pass for Redis to expire the key; 400ms leaves comfortable slack
        // over the 100ms TTL without slowing the suite meaningfully.
        Thread.sleep(400);

        assertThat(adapter.consume("expiring-state")).isEmpty();
    }

    @Test
    void stateIssuedOnOneInstanceIsConsumableOnAnother_exactlyOnce() {
        // Two adapters over two independent connections = the issue-#109 failure scenario:
        // instance A issues the state, Google's callback lands on instance B. In-memory this
        // fails with invalid_state; over Redis it must succeed, and only once globally.
        RedisClient otherClient =
                RedisClient.create("redis://" + REDIS.getHost() + ":" + REDIS.getMappedPort(6379));
        try (StatefulRedisConnection<String, String> otherConnection = otherClient.connect()) {
            OAuthStateStorePort instanceB = new RedisOAuthStateStoreAdapter(otherConnection);
            String state = "cross-instance-" + UUID.randomUUID();
            UUID coupleId = UUID.randomUUID();

            adapter.store(state, coupleId, Duration.ofMinutes(10));

            assertThat(instanceB.consume(state)).contains(coupleId);
            // Consumed on B means gone on A too: replay against any instance is rejected.
            assertThat(adapter.consume(state)).isEmpty();
        } finally {
            otherClient.shutdown();
        }
    }
}
