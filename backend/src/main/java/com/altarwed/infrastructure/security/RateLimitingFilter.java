package com.altarwed.infrastructure.security;

import com.altarwed.infrastructure.observability.LogSanitizer;
import com.altarwed.infrastructure.sharedstate.RateLimitBucketStore;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.BucketConfiguration;
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

// Protects abuse-sensitive endpoints (auth, RSVP, vendor inquiry, couple
// data-export) against brute force, spam, and bulk exfiltration. Token bucket
// per client IP, tiered by path (see Tier): the DEFAULT tier is 5 requests/minute
// with a 10-request burst ceiling; the RSVP tier is a more generous 20
// requests/minute for the token-resolution and submit paths a single household
// legitimately hits several times; the EXPORT tier is a tighter 6 requests/minute
// for the couple data-export endpoints, which are heavy full-serialization reads
// of a couple's guest list and website data.
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingFilter.class);

    // Where bucket state lives is delegated to the store (issue #109): in-memory per
    // instance by default (the exact Caffeine cache this filter used to own, bounds and
    // TTL unchanged, see InMemoryRateLimitBucketStore), or shared Redis when REDIS_URL is
    // set so limits stay global across App Service instances. Keyed by "tier|ip" so each
    // tier is an independent bucket and never lends tokens across path families.
    private final RateLimitBucketStore buckets;

    public RateLimitingFilter(RateLimitBucketStore buckets) {
        this.buckets = buckets;
    }

    // A rate-limit tier: an independent token-bucket configuration selected per
    // request from the URI. Keeping each limit as a separate bucket (not one
    // shared bucket) means the generous RSVP allowance can never relax the
    // stricter enumeration guard on /find (issue #255), a legitimate single-click
    // export can never be starved by unrelated auth traffic from the same
    // NAT/office IP, and the tighter export ceiling can never be relaxed by
    // DEFAULT tokens (issue #335).
    private enum Tier {
        // Auth, RSVP find-by-name, inquiries, promo redemption, unsubscribe:
        // 5 req/min steady, 10-request burst ceiling.
        DEFAULT,
        // RSVP token resolution (GET /rsvp/{token}) and submit (POST /rsvp):
        // 20 req/min per IP, generous enough for a household but still bounded so
        // the token path cannot be hammered at line speed (issue #255).
        RSVP,
        // Couple data-export (GET /couples/{id}/export/guests and /export/website):
        // 6 req/min per IP. Generous enough for a legitimate single-click export
        // (which fetches at most the two export endpoints, plus a retry or two),
        // but tight enough to block a stolen-token bulk dump or repeated hammering
        // of these full-serialization reads (issue #335).
        EXPORT
    }

    // Backend-neutral bucket shape (capacity + refill), consumed by whichever store is
    // active: the in-memory store builds a local bucket from it, the Redis store persists
    // it alongside the shared bucket state.
    private BucketConfiguration bucketConfig(Tier tier) {
        Bandwidth limit = switch (tier) {
            // Refill 5 tokens per 60 seconds, steady rate, no burst beyond 10.
            case DEFAULT -> Bandwidth.builder()
                    .capacity(10)
                    .refillGreedy(5, Duration.ofMinutes(1))
                    .build();
            // Refill 20 tokens per 60 seconds, generous for legitimate household use.
            case RSVP -> Bandwidth.builder()
                    .capacity(20)
                    .refillGreedy(20, Duration.ofMinutes(1))
                    .build();
            // Refill 6 tokens per 60 seconds, steady rate, no burst beyond 6.
            case EXPORT -> Bandwidth.builder()
                    .capacity(6)
                    .refillGreedy(6, Duration.ofMinutes(1))
                    .build();
        };
        return BucketConfiguration.builder().addLimit(limit).build();
    }

    // Selects the tier for a URI. Order matters: /rsvp/find is a sub-path of the
    // general /rsvp prefix but keeps the stricter DEFAULT bucket (name-enumeration
    // is the higher-value attack), so it must be matched before the RSVP prefix.
    // The couple data-export paths get the tighter EXPORT bucket; everything else
    // in the throttled set uses DEFAULT.
    private Tier tierFor(String uri) {
        if (uri.startsWith("/api/v1/guests/rsvp/find")) {
            return Tier.DEFAULT;
        }
        if (uri.startsWith("/api/v1/guests/rsvp")) {
            return Tier.RSVP;
        }
        if (isCoupleExportPath(uri)) {
            return Tier.EXPORT;
        }
        return Tier.DEFAULT;
    }

    // Matches GET /api/v1/couples/{coupleId}/export/... regardless of the UUID in
    // the path. Prefix + segment check avoids a regex on every request.
    private boolean isCoupleExportPath(String uri) {
        return uri.startsWith("/api/v1/couples/") && uri.contains("/export/");
    }

    // Paths that have abuse potential: unauthenticated brute-force/spam targets
    // (credential stuffing, name-enumeration on RSVP find, vendor-inquiry spam)
    // plus authenticated-but-sensitive endpoints (promo brute force, and the
    // couple data-export bulk reads, issue #335). Everything else either requires
    // JWT (already protected) or is a read-only GET on cached public data.
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        boolean rateLimited =
                uri.startsWith("/api/v1/auth/") ||
                // Covers RSVP find-by-name (GET /rsvp/find), token resolution
                // (GET /rsvp/{token}) and submit (POST /rsvp); tierFor picks the
                // strict vs generous bucket per path (issue #255).
                uri.startsWith("/api/v1/guests/rsvp") ||
                uri.startsWith("/api/v1/inquiries") ||
                // Authenticated, but the comp promo code is low-entropy and reusable, so throttle
                // redemption attempts to stop a logged-in vendor from brute-forcing the code.
                uri.startsWith("/api/v1/vendors/me/promo") ||
                // Authenticated, but a stolen 15-minute access token can bulk-dump a couple's
                // full guest list/website data; throttle the export reads (issue #335).
                isCoupleExportPath(uri) ||
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
        Tier tier = tierFor(request.getRequestURI());
        if (buckets.tryConsume(tier + "|" + ip, () -> bucketConfig(tier))) {
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
