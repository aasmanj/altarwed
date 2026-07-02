package com.altarwed.infrastructure.security;

import com.altarwed.infrastructure.observability.LogSanitizer;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

// Protects abuse-sensitive public endpoints (auth, RSVP find-by-name, vendor
// inquiry) against brute force and spam. Token bucket per IP: 5 requests/minute
// with a 10-request burst ceiling.
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingFilter.class);

    // Bounded + TTL-evicting (issue #41): an unbounded map keyed by client IP is
    // an OOM/DoS vector on its own, independent of the XFF-spoofing fix below.
    // 10 minutes is comfortably longer than the 1-minute refill window, so a
    // bucket never evicts mid-throttle; maximumSize is a hard backstop against a
    // single burst of unique IPs outrunning eviction.
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000)
            .expireAfterAccess(Duration.ofMinutes(10))
            .build();

    private Bucket newBucket() {
        // Refill 5 tokens per 60 seconds, steady rate, no burst beyond 10
        Bandwidth limit = Bandwidth.builder()
                .capacity(10)
                .refillGreedy(5, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    // Paths that are unauthenticated AND have abuse potential (credential
    // stuffing, name-enumeration on RSVP find, spam on vendor inquiry).
    // Everything else either requires JWT (already protected) or is read-only
    // GET on cached public data.
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        boolean rateLimited =
                uri.startsWith("/api/v1/auth/") ||
                uri.startsWith("/api/v1/guests/rsvp/find") ||
                uri.startsWith("/api/v1/inquiries") ||
                // Authenticated, but the comp promo code is low-entropy and reusable, so throttle
                // redemption attempts to stop a logged-in vendor from brute-forcing the code.
                uri.startsWith("/api/v1/vendors/me/promo") ||
                // Unauthenticated write: a token-verified opt-out, but throttle it so a
                // replayed/forged link can't churn the opt-out + audit tables or flood us.
                uri.startsWith("/api/v1/unsubscribe");
        return !rateLimited;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String ip = ClientIpResolver.resolve(request);
        Bucket bucket = buckets.get(ip, k -> newBucket());

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            // Security signal: spikes here mean brute-force attempts on auth endpoints.
            // IP is logged here (and only here) because it is required to actually
            // act on the alert. This is the "explicitly required for security audit"
            // exception called out in CLAUDE.md observability rule 8. Sanitized because
            // resolveClientIp's fallback (getHeader) is still attacker-influenced text.
            log.warn("rate limit exceeded, path={}, clientIp={}",
                    request.getRequestURI(), LogSanitizer.stripControlChars(ip));
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("""
                    {"type":"https://altarwed.com/problems/rate-limit-exceeded",\
                    "title":"Too Many Requests",\
                    "status":429,\
                    "detail":"Too many attempts. Please wait a minute and try again."}""");
        }
    }

}
