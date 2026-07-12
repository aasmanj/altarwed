package com.altarwed.infrastructure.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the per-slug anti-enumeration throttle (issue #89). Pure in-memory, no Spring.
 * Proves the security-relevant invariants directly: a slug locks out only after its failed-search
 * budget is spent, a successful match clears it, and buckets are isolated per slug.
 */
class InMemoryRsvpSearchThrottleAdapterTest {

    private static final int BUDGET = InMemoryRsvpSearchThrottleAdapter.FAILED_SEARCH_BUDGET;

    @Test
    void locksOutOnlyAfterBudgetOfFailedAttemptsIsSpent() {
        InMemoryRsvpSearchThrottleAdapter throttle = new InMemoryRsvpSearchThrottleAdapter();
        String slug = "jordan-and-eden";

        assertThat(throttle.isLockedOut(slug)).isFalse();
        for (int i = 0; i < BUDGET; i++) {
            assertThat(throttle.isLockedOut(slug)).as("not locked before budget spent").isFalse();
            throttle.recordFailedAttempt(slug);
        }
        // Budget exhausted: the wedding is now in cooldown.
        assertThat(throttle.isLockedOut(slug)).isTrue();
    }

    @Test
    void clearResetsAccumulatedFailures() {
        InMemoryRsvpSearchThrottleAdapter throttle = new InMemoryRsvpSearchThrottleAdapter();
        String slug = "jordan-and-eden";

        for (int i = 0; i < BUDGET; i++) {
            throttle.recordFailedAttempt(slug);
        }
        assertThat(throttle.isLockedOut(slug)).isTrue();

        // A real guest matching (or any success) clears the wedding's budget.
        throttle.clear(slug);
        assertThat(throttle.isLockedOut(slug)).isFalse();
    }

    @Test
    void bucketsAreIsolatedPerSlug() {
        InMemoryRsvpSearchThrottleAdapter throttle = new InMemoryRsvpSearchThrottleAdapter();
        String enumerated = "wedding-under-attack";
        String innocent = "some-other-wedding";

        for (int i = 0; i < BUDGET; i++) {
            throttle.recordFailedAttempt(enumerated);
        }

        // Locking out one wedding must never throttle a different one.
        assertThat(throttle.isLockedOut(enumerated)).isTrue();
        assertThat(throttle.isLockedOut(innocent)).isFalse();
    }
}
