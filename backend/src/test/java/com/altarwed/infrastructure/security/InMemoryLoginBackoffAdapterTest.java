package com.altarwed.infrastructure.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the per-account login backoff (issue #249). Pure in-memory, no Spring. A mutable
 * Clock drives time across cool-down boundaries deterministically, no sleeping. Proves the
 * security-relevant invariants directly: failures below the threshold never lock, the threshold
 * starts a cool-down, the cool-down escalates per subsequent failure up to the cap, success wipes
 * the history, and keys are isolated.
 */
class InMemoryLoginBackoffAdapterTest {

    private static final int THRESHOLD = InMemoryLoginBackoffAdapter.FAILURE_THRESHOLD;

    // Minimal settable clock; java.time has no mutable test clock of its own.
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-07-18T00:00:00Z");

        void advance(Duration d) { now = now.plus(d); }

        @Override public Instant instant() { return now; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
    }

    private MutableClock clock;
    private InMemoryLoginBackoffAdapter backoff;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        backoff = new InMemoryLoginBackoffAdapter(clock);
    }

    private void fail(String key, int times) {
        for (int i = 0; i < times; i++) {
            backoff.recordFailure(key);
        }
    }

    @Test
    void belowThresholdFailuresNeverLock() {
        String key = "couple@example.com";
        for (int i = 0; i < THRESHOLD - 1; i++) {
            backoff.recordFailure(key);
            assertThat(backoff.isLockedOut(key))
                    .as("failure %d of %d must not lock", i + 1, THRESHOLD - 1)
                    .isFalse();
        }
    }

    @Test
    void thresholdFailureStartsFirstCooldown() {
        String key = "couple@example.com";
        fail(key, THRESHOLD);

        assertThat(backoff.isLockedOut(key)).as("locked at threshold").isTrue();

        // Still locked just before the first cool-down (30s) ends...
        clock.advance(Duration.ofSeconds(29));
        assertThat(backoff.isLockedOut(key)).as("locked at 29s").isTrue();

        // ...and free again once it has elapsed. Backoff, not a hard lockout.
        clock.advance(Duration.ofSeconds(1));
        assertThat(backoff.isLockedOut(key)).as("unlocked at 30s").isFalse();
    }

    @Test
    void cooldownEscalatesPerFailureUpToTheCap() {
        String key = "target@example.com";
        fail(key, THRESHOLD); // failure 5 -> 30s

        // Expected schedule for failures 6..10: 60s, 2m, 5m, 15m, then capped at 15m.
        Duration[] expected = {
                Duration.ofSeconds(60),
                Duration.ofMinutes(2),
                Duration.ofMinutes(5),
                Duration.ofMinutes(15),
                Duration.ofMinutes(15) // beyond the schedule: stays at the cap
        };

        // Clear the 30s cool-down from failure 5 before the escalation loop.
        clock.advance(Duration.ofSeconds(30));

        for (Duration cooldown : expected) {
            assertThat(backoff.isLockedOut(key)).as("cool-down expired before next attempt").isFalse();
            backoff.recordFailure(key);
            assertThat(backoff.isLockedOut(key)).as("locked right after failure").isTrue();

            clock.advance(cooldown.minusSeconds(1));
            assertThat(backoff.isLockedOut(key))
                    .as("still locked 1s before a %s cool-down ends", cooldown)
                    .isTrue();

            clock.advance(Duration.ofSeconds(1));
            assertThat(backoff.isLockedOut(key))
                    .as("unlocked after the full %s cool-down", cooldown)
                    .isFalse();
        }
    }

    @Test
    void successClearsAllFailureHistory() {
        String key = "couple@example.com";
        fail(key, THRESHOLD);
        assertThat(backoff.isLockedOut(key)).isTrue();

        backoff.recordSuccess(key);
        assertThat(backoff.isLockedOut(key)).as("success ends any active cool-down").isFalse();

        // The counter is wiped, not merely the cool-down: a fresh sub-threshold run stays free.
        fail(key, THRESHOLD - 1);
        assertThat(backoff.isLockedOut(key)).as("history restarted from zero").isFalse();
        backoff.recordFailure(key);
        assertThat(backoff.isLockedOut(key)).as("new threshold reached, locks again").isTrue();
    }

    @Test
    void keysAreIsolated() {
        String attacked = "victim@example.com";
        String innocent = "someone-else@example.com";

        fail(attacked, THRESHOLD);

        assertThat(backoff.isLockedOut(attacked)).isTrue();
        assertThat(backoff.isLockedOut(innocent))
                .as("locking one email must never throttle another")
                .isFalse();
    }

    @Test
    void checkingLockoutNeverChargesTheKey() {
        String key = "couple@example.com";
        fail(key, THRESHOLD - 1);

        // Polling isLockedOut any number of times is a pure peek.
        for (int i = 0; i < 50; i++) {
            assertThat(backoff.isLockedOut(key)).isFalse();
        }
        backoff.recordFailure(key);
        assertThat(backoff.isLockedOut(key)).isTrue();
    }
}
