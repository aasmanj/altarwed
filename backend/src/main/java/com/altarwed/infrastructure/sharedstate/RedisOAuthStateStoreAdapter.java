package com.altarwed.infrastructure.sharedstate;

import com.altarwed.domain.port.OAuthStateStorePort;
import io.lettuce.core.RedisException;
import io.lettuce.core.api.StatefulRedisConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/**
 * Redis-backed OAuth state store (issue #109): the pending-state entry lives in the shared
 * Redis, so the Google callback succeeds no matter which App Service instance the load
 * balancer routes it to.
 *
 * <p>Semantics map one-to-one onto two atomic Redis commands, so no application-side expiry
 * bookkeeping or sweeping is needed:
 * <ul>
 *   <li>{@code store} = {@code PSETEX}: write with a millisecond TTL; Redis itself expires
 *       abandoned flows (the in-memory adapter's sweep-on-issue has no equivalent job here).</li>
 *   <li>{@code consume} = {@code GETDEL}: atomic read-and-delete, so a replayed callback
 *       observes the state already gone; expired keys are simply absent. Requires Redis 6.2+
 *       (every current Azure Cache for Redis tier).</li>
 * </ul>
 *
 * <p>Keys are namespaced under {@code altarwed:oauth-state:}, disjoint from the
 * {@code altarwed:rl:} bucket namespace. Values are only the couple UUID, never tokens or
 * secrets.
 *
 * <p><strong>Runtime failure policy: fail closed</strong> (the opposite of the rate-limit
 * store, deliberately): OAuth state is a CSRF control, not an abuse throttle, so a Redis
 * outage must never let a callback through unverified. The exception is logged as ERROR with
 * a clear "redis unavailable" message (this low-traffic path cannot flood App Insights) and
 * rethrown; the couple sees the connect attempt fail and retries once Redis is back.
 */
@Component
@Conditional(RedisConfiguredCondition.class)
public class RedisOAuthStateStoreAdapter implements OAuthStateStorePort {

    private static final Logger log = LoggerFactory.getLogger(RedisOAuthStateStoreAdapter.class);

    private static final String KEY_PREFIX = "altarwed:oauth-state:";

    private final StatefulRedisConnection<String, String> connection;

    public RedisOAuthStateStoreAdapter(StatefulRedisConnection<String, String> connection) {
        this.connection = connection;
    }

    @Override
    public void store(String state, UUID coupleId, Duration timeToLive) {
        try {
            connection.sync().psetex(KEY_PREFIX + state, timeToLive.toMillis(), coupleId.toString());
        } catch (RedisException ex) {
            log.error("oauth state store redis unavailable, google connect failing closed, coupleId={}",
                    coupleId, ex);
            throw ex;
        }
    }

    @Override
    public Optional<UUID> consume(String state) {
        String value;
        try {
            value = connection.sync().getdel(KEY_PREFIX + state);
        } catch (RedisException ex) {
            log.error("oauth state store redis unavailable, google callback failing closed", ex);
            throw ex;
        }
        if (value == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(value));
        } catch (IllegalArgumentException ex) {
            // Only this adapter writes the key and it only ever writes a UUID string, so an
            // unparseable value means the store was tampered with externally; log the tamper
            // signal (never the value itself, its provenance is unknown) and fail closed
            // rather than treating it as a clean invalid_state.
            log.error("oauth state value unparseable, treating as tampering and failing closed", ex);
            throw ex;
        }
    }
}
