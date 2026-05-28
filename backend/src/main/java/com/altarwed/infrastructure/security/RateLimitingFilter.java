package com.altarwed.infrastructure.security;

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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Protects abuse-sensitive public endpoints (auth, RSVP find-by-name, vendor
// inquiry) against brute force and spam. Token bucket per IP: 5 requests/minute
// with a 10-request burst ceiling. ConcurrentHashMap is safe here because
// Bucket4j's consume() is thread-safe.
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingFilter.class);

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    private Bucket newBucket() {
        // Refill 5 tokens per 60 seconds — steady rate, no burst beyond 10
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
                uri.startsWith("/api/v1/inquiries");
        return !rateLimited;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String ip = resolveClientIp(request);
        Bucket bucket = buckets.computeIfAbsent(ip, k -> newBucket());

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            // Security signal: spikes here mean brute-force attempts on auth endpoints.
            // IP is logged here (and only here) because it is required to actually
            // act on the alert. This is the "explicitly required for security audit"
            // exception called out in CLAUDE.md observability rule 8.
            log.warn("rate limit exceeded, path={}, clientIp={}", request.getRequestURI(), ip);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("""
                    {"type":"https://altarwed.com/problems/rate-limit-exceeded",\
                    "title":"Too Many Requests",\
                    "status":429,\
                    "detail":"Too many attempts. Please wait a minute and try again."}""");
        }
    }

    // X-Forwarded-For is set by Azure's load balancer — use it so we rate-limit
    // the real client IP, not the internal proxy IP. Fall back to remoteAddr if absent.
    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
