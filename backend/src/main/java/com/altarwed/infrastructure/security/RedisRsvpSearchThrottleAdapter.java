package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.RsvpSearchThrottlePort;
import com.altarwed.infrastructure.sharedstate.RateLimitBucketStore;
import com.altarwed.infrastructure.sharedstate.RedisConfiguredCondition;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.BucketConfiguration;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

/**
 * Redis-backed twin of {@link InMemoryRsvpSearchThrottleAdapter} (issue #414): same port, same
 * budget, same refill window (both adapters read the constants off the port itself, so the two
 * can never drift), but the bucket lives in the shared Redis via {@link RateLimitBucketStore}.
 * That closes the two multi-instance gaps the in-memory Javadoc documents as accepted
 * residuals: the effective budget stays {@code SEARCH_BUDGET} globally instead of
 * {@code N x SEARCH_BUDGET}, and a wedding locked out on instance A is equally locked out on
 * instance B.
 *
 * <p>One behavioral nuance versus the in-memory peek: {@code isLockedOut} on a key with no
 * prior attempts materializes the remote bucket at full capacity (a Redis round trip) rather
 * than short-circuiting on a missing map entry. The observable answer is identical, "not
 * locked", and the key expires on the proxy manager's TTL like any other.
 *
 * <p>Runtime Redis failures fail open (never locked out, attempts uncharged) with a throttled
 * ERROR log; that policy lives in {@link RedisRateLimitBucketStore}, not here.
 *
 * <p>Keys are prefixed {@code rsvp-search|}, disjoint from the {@code RateLimitingFilter}'s
 * {@code <TIER>|<ip>} keys inside the store's shared namespace.
 */
@Component
@Conditional(RedisConfiguredCondition.class)
public class RedisRsvpSearchThrottleAdapter implements RsvpSearchThrottlePort {

    private static final String KEY_PREFIX = "rsvp-search|";

    private final RateLimitBucketStore buckets;

    public RedisRsvpSearchThrottleAdapter(RateLimitBucketStore buckets) {
        this.buckets = buckets;
    }

    private static BucketConfiguration searchBudgetConfig() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(RsvpSearchThrottlePort.SEARCH_BUDGET)
                .refillGreedy(RsvpSearchThrottlePort.SEARCH_BUDGET, RsvpSearchThrottlePort.REFILL_WINDOW)
                .build();
        return BucketConfiguration.builder().addLimit(limit).build();
    }

    @Override
    public boolean isLockedOut(String key) {
        // A peek only: availableTokens never consumes, so checking lockout cannot itself
        // contribute to it (same contract as the in-memory adapter).
        return buckets.availableTokens(KEY_PREFIX + key, RedisRsvpSearchThrottleAdapter::searchBudgetConfig) <= 0;
    }

    @Override
    public void recordAttempt(String key) {
        // One token per find attempt, hit or miss; the result is ignored because the caller
        // gates on isLockedOut first, exactly as in the in-memory adapter.
        buckets.tryConsume(KEY_PREFIX + key, RedisRsvpSearchThrottleAdapter::searchBudgetConfig);
    }
}
