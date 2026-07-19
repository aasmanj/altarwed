package com.altarwed.infrastructure.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Sets a Cache-Control response header on public, unauthenticated GET/HEAD requests
 * according to {@link PublicCacheControlPolicy}.
 *
 * Why a filter instead of per-controller CacheControl: the public read surface spans a
 * dozen controllers, and the caching decision is a cross-cutting HTTP concern driven by
 * path, not by any single controller's business logic. Centralizing it in one filter with
 * a single path-to-policy table keeps the policy visible and testable in one place and
 * guarantees we cannot forget a header when a new public GET is added under an existing
 * whitelisted prefix. Per-controller {@code CacheControl.on(ResponseEntity)} would scatter
 * the same decision across every controller and drift over time.
 *
 * Trade-off worth stating: the header is written before the handler runs, so it is also
 * present on non-2xx responses (e.g. a 404 for an unknown wedding slug would carry the
 * short WEDDING policy). This is acceptable because (a) NO_STORE paths are always safe,
 * and (b) the cacheable tiers use short max-age plus stale-while-revalidate, so any cached
 * error self-heals within seconds. A future refinement could gate the cacheable tiers on a
 * 2xx status via a response wrapper, at the cost of more moving parts.
 *
 * Runs after {@link RequestIdFilter} so the requestId MDC is already populated. This filter
 * only mutates a response header; it never short-circuits the chain and logs nothing on the
 * hot read path (per the observability cost rule).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class CacheControlFilter extends OncePerRequestFilter {

    private final PublicCacheControlPolicy policy;

    public CacheControlFilter(PublicCacheControlPolicy policy) {
        this.policy = policy;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && path.startsWith(contextPath)) {
            path = path.substring(contextPath.length());
        }
        policy.resolve(request.getMethod(), path)
                .ifPresent(headerValue -> response.setHeader(HttpHeaders.CACHE_CONTROL, headerValue));
        chain.doFilter(request, response);
    }
}
