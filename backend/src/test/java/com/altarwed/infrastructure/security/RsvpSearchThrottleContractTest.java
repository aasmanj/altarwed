package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.RsvpSearchThrottlePort;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Port-level contract for {@link RsvpSearchThrottlePort} (issues #89/#414): the invariants
 * every adapter must uphold regardless of where its state lives. The same suite runs against
 * the in-memory adapter ({@link InMemoryRsvpSearchThrottleContractTest}) and the Redis adapter
 * ({@link RedisRsvpSearchThrottleAdapterTest}), which is the proof that flipping REDIS_URL
 * cannot change the security behavior the RSVP find endpoint depends on.
 *
 * <p>Keys are random per test so runs are independent even on a backend whose state outlives a
 * single test method (the shared Redis container).
 */
abstract class RsvpSearchThrottleContractTest {

    static final int BUDGET = RsvpSearchThrottlePort.SEARCH_BUDGET;

    /** The adapter under test; called once per test method. */
    abstract RsvpSearchThrottlePort throttle();

    private static String freshKey() {
        return "contract-" + UUID.randomUUID();
    }

    @Test
    void freshKeyIsNeverLockedOut() {
        assertThat(throttle().isLockedOut(freshKey())).isFalse();
    }

    @Test
    void locksOutOnlyAfterBudgetOfAttemptsIsSpent() {
        RsvpSearchThrottlePort throttle = throttle();
        String key = freshKey();

        for (int i = 0; i < BUDGET; i++) {
            assertThat(throttle.isLockedOut(key)).as("not locked before budget spent").isFalse();
            throttle.recordAttempt(key);
        }
        assertThat(throttle.isLockedOut(key)).isTrue();

        // Further attempts on an already-drained budget keep it locked (no accidental refill).
        throttle.recordAttempt(key);
        assertThat(throttle.isLockedOut(key)).isTrue();
    }

    @Test
    void peekingLockoutNeverConsumesBudget() {
        RsvpSearchThrottlePort throttle = throttle();
        String key = freshKey();

        // Hammer the peek far past the budget; if isLockedOut charged even one token this
        // would drain the bucket and the recordAttempt loop below would lock out early.
        for (int i = 0; i < BUDGET * 3; i++) {
            assertThat(throttle.isLockedOut(key)).isFalse();
        }
        for (int i = 0; i < BUDGET; i++) {
            assertThat(throttle.isLockedOut(key)).isFalse();
            throttle.recordAttempt(key);
        }
        assertThat(throttle.isLockedOut(key)).isTrue();
    }

    @Test
    void bucketsAreIsolatedPerKey() {
        RsvpSearchThrottlePort throttle = throttle();
        String enumerated = freshKey();
        String innocent = freshKey();

        for (int i = 0; i < BUDGET; i++) {
            throttle.recordAttempt(enumerated);
        }

        // Locking out one wedding must never throttle a different one.
        assertThat(throttle.isLockedOut(enumerated)).isTrue();
        assertThat(throttle.isLockedOut(innocent)).isFalse();
    }
}
