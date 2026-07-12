package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.RsvpSearchThrottlePort;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * In-memory, per-slug anti-enumeration throttle for the public find-invitation search
 * (issue #89), built in the same Bucket4j + Caffeine style as {@link RateLimitingFilter} so the
 * codebase has one throttling mechanism, not two. The filter throttles per client IP (bypassable
 * by X-Forwarded-For rotation, issue #41); this throttles per wedding slug, the actual unit of
 * enumeration, so it holds no matter how many source IPs an attacker spreads across.
 *
 * <p>Each slug gets a token bucket of {@link #FAILED_SEARCH_BUDGET} tokens that refill greedily
 * over {@link #REFILL_WINDOW}. A zero-result search consumes one token; when a slug's bucket is
 * empty it is "locked out" and further searches are rejected (429) until tokens refill. Greedy
 * refill is deliberate: after the threshold, searches are not banned outright but throttled to
 * roughly one lookup per {@code REFILL_WINDOW / FAILED_SEARCH_BUDGET}, which defeats scripted mass
 * enumeration while letting a real guest through after a short wait. A successful match clears the
 * slug's bucket, so a legitimate household that finds itself never leaves the wedding throttled.
 *
 * <p>Only failed (zero-result) searches are recorded, keeping the false-positive risk on a
 * popular wedding low: real guests who match do not consume budget and actively reset it.
 *
 * <p>In-memory and per instance, exactly like {@link RateLimitingFilter}. Multi-instance
 * coordination is out of scope here (it is for the whole rate-limit story) and is noted on the PR.
 */
@Component
public class InMemoryRsvpSearchThrottleAdapter implements RsvpSearchThrottlePort {

    // Small threshold: 10 zero-result name searches for one wedding within the window before it
    // enters cooldown. Generous enough that a couple of guests fat-fingering their names never
    // trips it, tight enough that blind enumeration of a guest list stalls quickly.
    static final int FAILED_SEARCH_BUDGET = 10;
    // Budget refills fully over this window (greedy, so partial refill accrues continuously).
    static final Duration REFILL_WINDOW = Duration.ofMinutes(10);

    // Bounded + TTL-evicting, matching RateLimitingFilter's rationale: an unbounded map keyed by
    // caller-influenced input is itself a memory-exhaustion vector. The TTL is longer than the
    // refill window so a bucket never evicts (and silently resets to full) mid-cooldown;
    // maximumSize is a hard backstop against a burst of unique slugs outrunning eviction.
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000)
            .expireAfterAccess(REFILL_WINDOW.plusMinutes(5))
            .build();

    private Bucket newBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(FAILED_SEARCH_BUDGET)
                .refillGreedy(FAILED_SEARCH_BUDGET, REFILL_WINDOW)
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    @Override
    public boolean isLockedOut(String slug) {
        Bucket bucket = buckets.getIfPresent(slug);
        // No bucket yet means no failures recorded, so never locked. A peek only: getAvailableTokens
        // does not consume, so checking lockout cannot itself contribute to it.
        return bucket != null && bucket.getAvailableTokens() <= 0;
    }

    @Override
    public void recordFailedAttempt(String slug) {
        buckets.get(slug, k -> newBucket()).tryConsume(1);
    }

    @Override
    public void clear(String slug) {
        // Drop the bucket entirely: the next failed search starts from a full budget again.
        buckets.invalidate(slug);
    }
}
