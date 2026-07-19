package com.altarwed.infrastructure.observability;

import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;

import java.util.List;
import java.util.Optional;

/**
 * Pure path-to-Cache-Control policy for the public, unauthenticated GET surface.
 *
 * Why this exists: none of the public GETs emitted a Cache-Control header, so every
 * guest hit on a wedding site, vendor listing, blog post or scripture lookup fell
 * through to the origin App Service and nothing could be cached by the browser or a
 * future edge/CDN (issue #375 depends on these headers being correct). This class is
 * the single source of truth for "which public path gets which caching policy"; the
 * servlet {@link CacheControlFilter} just applies whatever this returns.
 *
 * Design choices:
 * - Kept as plain logic (no Spring stereotype, no servlet types) so the mapping can be
 *   unit-tested in isolation without booting a web context. This is the behavioral
 *   contract the tests assert against.
 * - Only GET and HEAD are ever considered cacheable. Every write verb (POST/PUT/PATCH/
 *   DELETE) and every path not on the public whitelist returns empty, i.e. we leave the
 *   response untouched exactly as it is today. We never widen caching to an authenticated
 *   or write endpoint.
 * - Rules are evaluated in order, first match wins. NO_STORE rules are listed first so
 *   that an auth-adjacent or draft path (e.g. /vendors/me, /preview/**, RSVP token reads)
 *   can never be caught by a broader cacheable wildcard below it.
 *
 * TTL rationale (validated against the frontend ISR values in frontend-public/CLAUDE.md):
 * - Wedding-site data: browsers/edge may serve for 30s and revalidate in the background
 *   up to 60s. Matches the 60s wedding ISR while keeping origin freshness tight.
 * - Vendor directory/listing: the vendor ISR is 15s ("new vendors appear quickly"), so
 *   this tier is intentionally FRESHER than the wedding tier, not longer. Discovery of a
 *   newly listed vendor is a product requirement that outranks raw cache-hit ratio.
 * - Blog: 1h max-age, 1d stale-while-revalidate. Blog posts change rarely and are the SEO
 *   long tail; the frontend already targets 3600s here.
 * - Scripture / denominations: reference data that effectively never changes, so a 1d
 *   max-age with a 7d stale window.
 */
@Component
public final class PublicCacheControlPolicy {

    /**
     * Named caching tiers. The header value is a literal Cache-Control directive string so
     * the exact bytes on the wire are visible and directly assertable in tests.
     */
    public enum CachePolicy {
        /** Never cache: draft previews, RSVP token reads, and anything auth-adjacent. */
        NO_STORE("no-store"),
        /** Wedding-site public data: short and background-revalidated. */
        WEDDING("public, max-age=30, stale-while-revalidate=60"),
        /** Vendor directory/listing: fresher than wedding so new vendors surface fast. */
        VENDORS("public, max-age=15, stale-while-revalidate=60"),
        /** Blog posts: long-lived SEO content. */
        BLOG("public, max-age=3600, stale-while-revalidate=86400"),
        /** Scripture and denominations: near-immutable reference data. */
        REFERENCE("public, max-age=86400, stale-while-revalidate=604800");

        private final String headerValue;

        CachePolicy(String headerValue) {
            this.headerValue = headerValue;
        }

        public String headerValue() {
            return headerValue;
        }
    }

    private record Rule(String pattern, CachePolicy policy) {
    }

    // AntPathMatcher is stateless and thread-safe once constructed, so a single shared
    // instance is safe across all requests.
    private static final AntPathMatcher MATCHER = new AntPathMatcher();

    // First match wins. NO_STORE rules MUST precede any cacheable wildcard that could
    // otherwise swallow them (e.g. /vendors/me before /vendors/**).
    private static final List<Rule> RULES = List.of(
            // --- never cache: drafts, token reads, auth-adjacent ---
            new Rule("/api/v1/wedding-websites/preview/**", CachePolicy.NO_STORE),
            new Rule("/api/v1/wedding-page-blocks/preview/**", CachePolicy.NO_STORE),
            new Rule("/api/v1/wedding-photos/website/preview/**", CachePolicy.NO_STORE),
            new Rule("/api/v1/guests/rsvp/**", CachePolicy.NO_STORE),
            new Rule("/api/v1/vendors/me", CachePolicy.NO_STORE),
            new Rule("/api/v1/vendors/me/**", CachePolicy.NO_STORE),

            // --- wedding-site public data (max-age 30s, swr 60s) ---
            new Rule("/api/v1/wedding-websites/slug/**", CachePolicy.WEDDING),
            new Rule("/api/v1/wedding-websites/published", CachePolicy.WEDDING),
            new Rule("/api/v1/wedding-websites/search", CachePolicy.WEDDING),
            new Rule("/api/v1/wedding-websites/*/hotels", CachePolicy.WEDDING),
            new Rule("/api/v1/wedding-party/website/**", CachePolicy.WEDDING),
            new Rule("/api/v1/wedding-photos/website/slug/**", CachePolicy.WEDDING),
            new Rule("/api/v1/wedding-page-blocks/slug/**", CachePolicy.WEDDING),

            // --- vendor directory/listing (max-age 15s, swr 60s) ---
            new Rule("/api/v1/vendors", CachePolicy.VENDORS),
            new Rule("/api/v1/vendors/**", CachePolicy.VENDORS),

            // --- long-lived SEO content ---
            new Rule("/api/v1/blog/**", CachePolicy.BLOG),

            // --- near-immutable reference data ---
            new Rule("/api/v1/scripture/**", CachePolicy.REFERENCE),
            new Rule("/api/v1/denominations", CachePolicy.REFERENCE),
            new Rule("/api/v1/denominations/**", CachePolicy.REFERENCE)
    );

    /**
     * Resolve the Cache-Control header value for a request, or empty to leave the response
     * untouched. Only GET and HEAD on a whitelisted public path ever return a value.
     *
     * @param httpMethod the HTTP method (case-insensitive)
     * @param path       the request path within the application (context path already stripped)
     */
    public Optional<String> resolve(String httpMethod, String path) {
        if (httpMethod == null || path == null) {
            return Optional.empty();
        }
        if (!"GET".equalsIgnoreCase(httpMethod) && !"HEAD".equalsIgnoreCase(httpMethod)) {
            return Optional.empty();
        }
        for (Rule rule : RULES) {
            if (MATCHER.match(rule.pattern(), path)) {
                return Optional.of(rule.policy().headerValue());
            }
        }
        return Optional.empty();
    }
}
