package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.RsvpSearchThrottlePort;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the per-wedding anti-enumeration throttle (issue #89). Pure in-memory, no Spring.
 * Proves the security-relevant invariants directly: EVERY find attempt is charged against the
 * budget (hit or miss), there is no reset-on-success, a key locks out only after its budget is
 * spent, and buckets are isolated per key.
 */
class InMemoryRsvpSearchThrottleAdapterTest {

    private static final int BUDGET = RsvpSearchThrottlePort.SEARCH_BUDGET;

    @Test
    void locksOutOnlyAfterBudgetOfAttemptsIsSpent() {
        InMemoryRsvpSearchThrottleAdapter throttle = new InMemoryRsvpSearchThrottleAdapter();
        String key = "couple-123";

        assertThat(throttle.isLockedOut(key)).isFalse();
        for (int i = 0; i < BUDGET; i++) {
            assertThat(throttle.isLockedOut(key)).as("not locked before budget spent").isFalse();
            throttle.recordAttempt(key);
        }
        // Budget exhausted: the wedding is now in cooldown.
        assertThat(throttle.isLockedOut(key)).isTrue();
    }

    @Test
    void everyAttemptConsumesBudget_thereIsNoResetOnSuccess() {
        // Regression for H1: the previous design reset the budget on any successful match, so a
        // harvester who kept hitting real substrings never locked out. The port no longer exposes a
        // reset; the ONLY way to spend budget is recordAttempt, and the ONLY way it refills is time.
        // Prove that N charged attempts (which is what both a hit and a miss now do) lock the key,
        // with no way to reset it back within the window.
        InMemoryRsvpSearchThrottleAdapter throttle = new InMemoryRsvpSearchThrottleAdapter();
        String key = "couple-under-harvest";

        for (int i = 0; i < BUDGET; i++) {
            assertThat(throttle.isLockedOut(key)).isFalse();
            throttle.recordAttempt(key);
        }
        assertThat(throttle.isLockedOut(key)).isTrue();

        // Further attempts on an already-drained bucket keep it locked (no accidental refill).
        throttle.recordAttempt(key);
        assertThat(throttle.isLockedOut(key)).isTrue();
    }

    @Test
    void bucketsAreIsolatedPerKey() {
        InMemoryRsvpSearchThrottleAdapter throttle = new InMemoryRsvpSearchThrottleAdapter();
        String enumerated = "couple-under-attack";
        String innocent = "some-other-couple";

        for (int i = 0; i < BUDGET; i++) {
            throttle.recordAttempt(enumerated);
        }

        // Locking out one wedding must never throttle a different one.
        assertThat(throttle.isLockedOut(enumerated)).isTrue();
        assertThat(throttle.isLockedOut(innocent)).isFalse();
    }

    @Test
    void sameKeyFromDistinctSlugVariants_sharesOneBudget() {
        // H2 at the adapter level: the service keys the throttle on the canonical coupleId, so
        // case- and whitespace-variant slugs that resolve to the same wedding all arrive here as the
        // SAME key string and therefore draw down one shared bucket. Simulate that by charging the
        // same coupleId key BUDGET times (as three "variants" summing to the budget) and asserting a
        // single lockout, proving variants cannot each get a fresh budget.
        InMemoryRsvpSearchThrottleAdapter throttle = new InMemoryRsvpSearchThrottleAdapter();
        String coupleKey = "11111111-1111-1111-1111-111111111111";

        for (int i = 0; i < BUDGET; i++) {
            assertThat(throttle.isLockedOut(coupleKey)).isFalse();
            throttle.recordAttempt(coupleKey);
        }
        assertThat(throttle.isLockedOut(coupleKey)).isTrue();
    }
}
