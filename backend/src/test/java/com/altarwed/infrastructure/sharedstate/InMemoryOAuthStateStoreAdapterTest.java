package com.altarwed.infrastructure.sharedstate;

import com.altarwed.domain.port.OAuthStateStorePort;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs the {@link OAuthStateStoreContractTest} contract against the in-memory adapter, plus
 * expiry semantics under a fake clock (no sleeping): the extracted adapter must keep the exact
 * behavior of the map that previously lived inline in {@code GoogleOAuthService}.
 */
class InMemoryOAuthStateStoreAdapterTest extends OAuthStateStoreContractTest {

    // Fake millisecond clock, advanced explicitly by the expiry tests; contract tests never
    // advance it so entries stay live.
    private final AtomicLong nowMillis = new AtomicLong(1_000_000L);

    private final InMemoryOAuthStateStoreAdapter adapter =
            new InMemoryOAuthStateStoreAdapter(nowMillis::get);

    @Override
    OAuthStateStorePort store() {
        return adapter;
    }

    @Test
    void expiredStateComesBackEmpty() {
        UUID coupleId = UUID.randomUUID();
        adapter.store("expiring-state", coupleId, Duration.ofMinutes(10));

        nowMillis.addAndGet(Duration.ofMinutes(10).toMillis() + 1);

        assertThat(adapter.consume("expiring-state")).isEmpty();
    }

    @Test
    void stateOnTheEdgeOfItsTtlIsStillValid() {
        UUID coupleId = UUID.randomUUID();
        adapter.store("edge-state", coupleId, Duration.ofMinutes(10));

        // Exactly at expiry (not past it) the original inline logic accepted the state; the
        // extracted adapter must not tighten that.
        nowMillis.addAndGet(Duration.ofMinutes(10).toMillis());

        assertThat(adapter.consume("edge-state")).contains(coupleId);
    }

    @Test
    void expiredEntriesAreSweptWhenANewStateIsIssued() {
        adapter.store("abandoned", UUID.randomUUID(), Duration.ofMinutes(10));
        nowMillis.addAndGet(Duration.ofMinutes(11).toMillis());

        // Issuing a new state triggers the opportunistic sweep of the abandoned one; either
        // way it must be unconsumable, and the fresh one must be live.
        UUID coupleId = UUID.randomUUID();
        adapter.store("fresh", coupleId, Duration.ofMinutes(10));

        assertThat(adapter.consume("abandoned")).isEmpty();
        assertThat(adapter.consume("fresh")).contains(coupleId);
    }
}
