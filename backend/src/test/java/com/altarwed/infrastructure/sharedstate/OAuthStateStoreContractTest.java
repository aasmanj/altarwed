package com.altarwed.infrastructure.sharedstate;

import com.altarwed.domain.port.OAuthStateStorePort;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Port-level contract for {@link OAuthStateStorePort} (issue #109): the CSRF properties the
 * Google OAuth callback relies on, identical whichever adapter is active. Expiry is asserted
 * per subclass because controlling time differs by backend (fake clock in-memory, real TTL on
 * Redis).
 */
abstract class OAuthStateStoreContractTest {

    static final Duration TTL = Duration.ofMinutes(10);

    /** The adapter under test; called once per test method. */
    abstract OAuthStateStorePort store();

    private static String freshState() {
        return "state-" + UUID.randomUUID();
    }

    @Test
    void consumeReturnsTheCoupleBoundToTheState() {
        OAuthStateStorePort store = store();
        String state = freshState();
        UUID coupleId = UUID.randomUUID();

        store.store(state, coupleId, TTL);

        assertThat(store.consume(state)).contains(coupleId);
    }

    @Test
    void consumeIsOneTimeUse_replayComesBackEmpty() {
        OAuthStateStorePort store = store();
        String state = freshState();
        store.store(state, UUID.randomUUID(), TTL);

        assertThat(store.consume(state)).isPresent();
        // A second callback presenting the same state is a replay and must be rejected.
        assertThat(store.consume(state)).isEmpty();
    }

    @Test
    void unknownStateComesBackEmpty() {
        assertThat(store().consume(freshState())).isEmpty();
    }

    @Test
    void statesAreIndependent_consumingOneLeavesOthersIntact() {
        OAuthStateStorePort store = store();
        String stateA = freshState();
        String stateB = freshState();
        UUID coupleA = UUID.randomUUID();
        UUID coupleB = UUID.randomUUID();

        store.store(stateA, coupleA, TTL);
        store.store(stateB, coupleB, TTL);

        assertThat(store.consume(stateA)).contains(coupleA);
        assertThat(store.consume(stateB)).contains(coupleB);
    }
}
