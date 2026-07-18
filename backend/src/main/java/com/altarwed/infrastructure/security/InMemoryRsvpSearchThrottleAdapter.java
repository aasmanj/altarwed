package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.RsvpSearchThrottlePort;
import com.altarwed.infrastructure.sharedstate.RedisNotConfiguredCondition;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

/**
 * In-memory, per-wedding anti-enumeration throttle for the public find-invitation search
 * (issue #89), built in the same Bucket4j + Caffeine style as {@link RateLimitingFilter} so the
 * codebase has one throttling mechanism, not two. The filter throttles per client IP (bypassable
 * by X-Forwarded-For rotation, issue #41); this throttles per wedding, the actual unit of
 * enumeration, so it holds no matter how many source IPs an attacker spreads across.
 *
 * <p>Each wedding key gets a token bucket of {@link #SEARCH_BUDGET} tokens that refill greedily
 * over {@link #REFILL_WINDOW}. EVERY find attempt consumes one token, hit or miss; when a key's
 * bucket is empty it is "locked out" and further searches are rejected (429) until tokens refill.
 * There is no reset-on-success: an earlier design only counted misses and cleared the budget on any
 * match, but the find endpoint's match is a case-insensitive SUBSTRING lookup returning up to five
 * masked names plus live RSVP tokens, so counting only misses left the harvest path (successful
 * substring guesses) completely unthrottled and self-resetting. Charging every attempt bounds total
 * lookups per wedding per window.
 *
 * <p>Greedy refill is deliberate: after the budget is spent, searches are not banned outright but
 * throttled to roughly one lookup per {@code REFILL_WINDOW / SEARCH_BUDGET}, which defeats scripted
 * mass enumeration while letting a real guest through after a short wait. The capacity is tuned so a
 * genuine household (a handful of lookups to find themselves) is never blocked, but a harvester
 * walking a name dictionary is bounded.
 *
 * <p>The key is the wedding's canonical identity (couple id string), resolved by the caller from
 * the slug BEFORE this throttle is consulted, so case- and whitespace-variant slugs for the same
 * wedding ("Jordan-Eden", "jordan-eden", " jordan-eden") share one bucket instead of getting a
 * fresh budget each (issue #89 / H2). This adapter treats the key as an opaque string; canonicalizing
 * it is the service's job.
 *
 * <p>In-memory and per instance. This is the default adapter, active only while
 * {@code altarwed.redis.url} is blank; setting {@code REDIS_URL} swaps in
 * {@link RedisRsvpSearchThrottleAdapter} (same budget constants, shared store) for
 * multi-instance coordination (issue #414).
 */
@Component
@Conditional(RedisNotConfiguredCondition.class)
public class InMemoryRsvpSearchThrottleAdapter implements RsvpSearchThrottlePort {

    // Budget and refill window are defined on the port (SEARCH_BUDGET / REFILL_WINDOW), the
    // single source of truth shared with the Redis adapter so the two can never drift.

    // Bounded + TTL-evicting, matching RateLimitingFilter's rationale: an unbounded map keyed by
    // caller-influenced input is itself a memory-exhaustion vector. The TTL is longer than the
    // refill window so a bucket never evicts (and silently resets to full) mid-cooldown;
    // maximumSize is a hard backstop against a burst of unique keys outrunning eviction.
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000)
            .expireAfterAccess(REFILL_WINDOW.plusMinutes(5))
            .build();

    private Bucket newBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(SEARCH_BUDGET)
                .refillGreedy(SEARCH_BUDGET, REFILL_WINDOW)
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    @Override
    public boolean isLockedOut(String key) {
        Bucket bucket = buckets.getIfPresent(key);
        // No bucket yet means no attempts recorded, so never locked. A peek only: getAvailableTokens
        // does not consume, so checking lockout cannot itself contribute to it.
        return bucket != null && bucket.getAvailableTokens() <= 0;
    }

    @Override
    public void recordAttempt(String key) {
        // One token per find attempt, hit or miss. tryConsume returns false when the bucket is
        // already empty; we ignore the result because the caller gates on isLockedOut first, and a
        // best-effort consume when a concurrent request drained the last token is harmless.
        buckets.get(key, k -> newBucket()).tryConsume(1);
    }
}
