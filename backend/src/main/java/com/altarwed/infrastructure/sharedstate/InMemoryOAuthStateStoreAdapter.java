package com.altarwed.infrastructure.sharedstate;

import com.altarwed.domain.port.OAuthStateStorePort;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Default, per-JVM OAuth state store: the exact {@code ConcurrentHashMap} logic that lived
 * inline in {@code GoogleOAuthService} before issue #109 extracted it behind
 * {@link OAuthStateStorePort}, preserved verbatim so behavior with no {@code REDIS_URL} is
 * identical to what shipped. Same semantics: put with an absolute expiry, sweep expired
 * entries on every new issue, and remove-then-expiry-check on consume.
 *
 * <p>Per instance by design, which is exactly why the port exists: on more than one instance
 * the provider callback can land on an instance that never issued the state and fail with
 * {@code invalid_state}. {@code SharedStateStartupLogger} warns in prod until the Redis
 * adapter takes over.
 */
@Component
@Conditional(RedisNotConfiguredCondition.class)
public class InMemoryOAuthStateStoreAdapter implements OAuthStateStorePort {

    private final ConcurrentHashMap<String, PendingState> pendingStates = new ConcurrentHashMap<>();

    // Injectable clock (millis) so expiry is unit-testable without sleeping; production uses
    // the real system clock via the default constructor.
    private final LongSupplier clockMillis;

    public InMemoryOAuthStateStoreAdapter() {
        this(System::currentTimeMillis);
    }

    InMemoryOAuthStateStoreAdapter(LongSupplier clockMillis) {
        this.clockMillis = clockMillis;
    }

    private record PendingState(UUID coupleId, long expiresEpochMs) {}

    @Override
    public void store(String state, UUID coupleId, Duration timeToLive) {
        pendingStates.put(state, new PendingState(coupleId, clockMillis.getAsLong() + timeToLive.toMillis()));
        // Opportunistic sweep on each issue (unchanged from the inline original): with no
        // background timer, abandoned flows are reclaimed the next time anyone starts one,
        // bounding the map by the issue rate within the TTL window.
        cleanExpiredStates();
    }

    @Override
    public Optional<UUID> consume(String state) {
        PendingState pending = pendingStates.remove(state);
        if (pending == null || clockMillis.getAsLong() > pending.expiresEpochMs()) {
            return Optional.empty();
        }
        return Optional.of(pending.coupleId());
    }

    private void cleanExpiredStates() {
        long now = clockMillis.getAsLong();
        pendingStates.entrySet().removeIf(e -> e.getValue().expiresEpochMs() < now);
    }
}
