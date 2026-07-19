package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.InquiryThrottlePort;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * In-memory, per-vendor inbound send cap for the public inquiry endpoint (issue #100),
 * built in the same Bucket4j + Caffeine style as {@link RateLimitingFilter} and
 * {@link InMemoryRsvpSearchThrottleAdapter} so the codebase has one throttling
 * mechanism, not three. The filter throttles per client IP (bypassable by
 * X-Forwarded-For rotation, issue #41); this throttles per TARGET vendor, the actual
 * unit of email-flood abuse, so it holds no matter how many source IPs an attacker
 * spreads across.
 *
 * <p>Each vendor key gets a token bucket of {@link #INQUIRY_BUDGET} tokens refilling
 * greedily over {@link #REFILL_WINDOW}. Greedy refill means an over-cap vendor is not
 * banned outright but trickles back to roughly one inquiry per
 * {@code REFILL_WINDOW / INQUIRY_BUDGET} (3 minutes at 20/hour), which caps sustained
 * flood throughput at a rate a real inbox shrugs off while a legitimate burst of
 * genuine couples (a vendor being featured, say) mostly gets through.
 *
 * <p>The caller charges the budget only AFTER captcha verification and active-vendor
 * resolution succeed, so failed bot traffic cannot consume a vendor's budget and
 * starve real couples (see {@link InquiryThrottlePort}).
 *
 * <p>In-memory and per instance, exactly like the other two throttles. Multi-instance
 * coordination via a shared Redis store is issue #109 and applies to all three at once.
 */
@Component
public class InMemoryInquiryThrottleAdapter implements InquiryThrottlePort {

    // Accepted inquiries allowed per vendor per rolling window. 20/hour is far above
    // any plausible organic rate for a single vendor listing today (each inquiry is a
    // couple hand-typing a 10+ character message), but caps a flood at a volume that
    // neither buries the vendor's inbox nor dents Resend sender reputation.
    static final int INQUIRY_BUDGET = 20;
    // Budget refills fully over this window (greedy, so partial refill accrues continuously).
    static final Duration REFILL_WINDOW = Duration.ofHours(1);

    // Bounded + TTL-evicting, matching RateLimitingFilter's rationale: an unbounded map
    // keyed by caller-influenced input is itself a memory-exhaustion vector. Keys here
    // are ids of REAL active vendors (resolved before the throttle is consulted), so the
    // key space is small, but the backstop costs nothing. The TTL is longer than the
    // refill window so a bucket never evicts (and silently resets to full) mid-cooldown.
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000)
            .expireAfterAccess(REFILL_WINDOW.plusMinutes(5))
            .build();

    private Bucket newBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(INQUIRY_BUDGET)
                .refillGreedy(INQUIRY_BUDGET, REFILL_WINDOW)
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    @Override
    public boolean tryAcquire(String vendorKey) {
        // Atomic check-and-consume: tryConsume is thread-safe per bucket, so two
        // concurrent requests can never both pass on the last remaining token.
        return buckets.get(vendorKey, k -> newBucket()).tryConsume(1);
    }
}
