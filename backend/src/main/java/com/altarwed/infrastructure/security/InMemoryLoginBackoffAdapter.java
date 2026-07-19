package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.LoginBackoffPort;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * In-memory per-account login backoff (issue #249), built in the same Caffeine style as
 * {@link RateLimitingFilter} and {@link InMemoryRsvpSearchThrottleAdapter} so the codebase keeps
 * one throttling idiom. Bucket4j is deliberately NOT used here: a token bucket models a steady
 * refill rate, but the required behavior is a consecutive-failure counter with an escalating
 * cool-down schedule and reset-on-success, which a bucket cannot express.
 *
 * <p>Schedule: the first {@link #FAILURE_THRESHOLD} consecutive failures are free. Failure number
 * 5 starts a 30s cool-down; each further failure (necessarily after the previous cool-down
 * expired, because attempts during a cool-down are rejected upstream and never charged) escalates
 * through {@link #COOLDOWNS} to a hard cap of 15 minutes. Post-threshold an attacker gets roughly
 * one guess per cap window; a distributed credential-stuffing run against one email drops from
 * unbounded to a handful of guesses per hour, while the worst-case collateral for the real owner
 * is one capped wait. Success clears the key entirely.
 *
 * <p>The cache is bounded and TTL-evicting for the same reason as the other throttles: it is
 * keyed by attacker-supplied input (any email string), so an unbounded map is itself a
 * memory-exhaustion vector. {@link #IDLE_EXPIRY} doubles as the rolling window: a key untouched
 * for that long is forgotten, so five failures spread over months never lock anyone out. The TTL
 * is comfortably longer than the longest cool-down, so an entry can never evict (and silently
 * reset) mid-cool-down; reads refresh the TTL, keeping an actively-attacked key alive.
 *
 * <p>In-memory and per instance, exactly like the other throttles. Issues #109/#414 track moving
 * these stores to shared Redis before scale-out; behind the {@code LoginBackoffPort} interface
 * that swap touches no service code.
 */
@Component
public class InMemoryLoginBackoffAdapter implements LoginBackoffPort {

    // Free failures before any cool-down. 5 comfortably covers a real user fumbling a password
    // manager or trying a few old passwords, per the issue's acceptance criteria.
    static final int FAILURE_THRESHOLD = 5;

    // Escalation schedule, indexed by (failures - FAILURE_THRESHOLD), capped at the last entry.
    static final List<Duration> COOLDOWNS = List.of(
            Duration.ofSeconds(30),
            Duration.ofSeconds(60),
            Duration.ofMinutes(2),
            Duration.ofMinutes(5),
            Duration.ofMinutes(15)
    );

    // Idle time after which a key's failure history is forgotten (the "rolling window").
    // Must stay longer than the last COOLDOWNS entry so a cool-down can never evict early.
    static final Duration IDLE_EXPIRY = Duration.ofMinutes(30);

    // Consecutive-failure count plus the moment the current cool-down (if any) ends.
    private record FailureState(int failures, Instant lockedUntil) {}

    private final Clock clock;
    private final Cache<String, FailureState> states;

    public InMemoryLoginBackoffAdapter() {
        this(Clock.systemUTC());
    }

    // Package-private for tests, which drive a mutable Clock to cross cool-down boundaries
    // deterministically instead of sleeping.
    InMemoryLoginBackoffAdapter(Clock clock) {
        this.clock = clock;
        this.states = Caffeine.newBuilder()
                .maximumSize(100_000)
                .expireAfterAccess(IDLE_EXPIRY)
                .build();
    }

    @Override
    public boolean isLockedOut(String emailKey) {
        FailureState state = states.getIfPresent(emailKey);
        return state != null
                && state.lockedUntil() != null
                && clock.instant().isBefore(state.lockedUntil());
    }

    @Override
    public void recordFailure(String emailKey) {
        // compute on the ConcurrentMap view is atomic per key, so two parallel failed logins
        // for the same email cannot lose an increment.
        states.asMap().compute(emailKey, (k, prev) -> {
            int failures = (prev == null ? 0 : prev.failures()) + 1;
            Instant lockedUntil = failures >= FAILURE_THRESHOLD
                    ? clock.instant().plus(cooldownFor(failures))
                    : null;
            return new FailureState(failures, lockedUntil);
        });
    }

    @Override
    public void recordSuccess(String emailKey) {
        states.invalidate(emailKey);
    }

    private static Duration cooldownFor(int failures) {
        int index = Math.min(failures - FAILURE_THRESHOLD, COOLDOWNS.size() - 1);
        return COOLDOWNS.get(index);
    }
}
