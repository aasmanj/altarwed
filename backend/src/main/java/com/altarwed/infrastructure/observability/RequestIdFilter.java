package com.altarwed.infrastructure.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Stamps every HTTP request with a correlation ID before any other filter runs,
 * so every log line emitted during the request can be tied back to one user
 * action in Azure App Insights via the {requestId} MDC field.
 *
 * - If the client sent X-Request-Id (e.g. a load balancer that already assigned one),
 *   we honor it. Otherwise we generate a fresh UUID.
 * - The id is mirrored back on the response so users can quote it in support tickets.
 * - MDC.clear() in finally is critical: thread pool reuse would otherwise leak the
 *   previous request's id into the next request, polluting logs and risking confidentiality.
 *
 * Runs at HIGHEST_PRECEDENCE so subsequent filters (rate-limiting, JWT auth) already
 * have the requestId in MDC when they log.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String MDC_REQUEST_ID = "requestId";
    public static final String HEADER_REQUEST_ID = "X-Request-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader(HEADER_REQUEST_ID);
        String requestId = (incoming != null && !incoming.isBlank() && incoming.length() <= 64)
                ? incoming
                : UUID.randomUUID().toString();
        MDC.put(MDC_REQUEST_ID, requestId);
        response.setHeader(HEADER_REQUEST_ID, requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_REQUEST_ID);
        }
    }
}
