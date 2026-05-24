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
import java.util.regex.Pattern;

/**
 * Stamps every HTTP request with a correlation ID before any other filter runs,
 * so every log line emitted during the request can be tied back to one user
 * action in Azure App Insights via the {requestId} MDC field.
 *
 * - If the client sent X-Request-Id (e.g. a load balancer that already assigned one),
 *   we honor it ONLY when it matches a strict character whitelist. This prevents log
 *   injection: a hostile client otherwise could send "X-Request-Id: foo\r\n2026-...
 *   INFO admin login succeeded" and forge log lines in App Insights.
 * - The id is mirrored back on the response so users can quote it in support tickets.
 * - MDC.clear() in finally is critical: thread pool reuse (carrier threads for virtual
 *   threads, Tomcat worker reuse for blocking endpoints) would otherwise leak the
 *   previous request's id into the next request, polluting logs and risking PII
 *   cross-contamination as more MDC keys get added (userId, coupleId).
 *
 * Runs at HIGHEST_PRECEDENCE so subsequent filters (rate-limiting, JWT auth) already
 * have the requestId in MDC when they log.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String MDC_REQUEST_ID = "requestId";
    public static final String HEADER_REQUEST_ID = "X-Request-Id";

    // Strict whitelist: alphanumeric, dot, underscore, hyphen, length 8-64.
    // Anything else (CRLF, control chars, brackets, spaces, percent-encoding) is
    // rejected and we generate our own id. This blocks log-injection attacks via
    // the incoming header.
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("^[A-Za-z0-9._-]{8,64}$");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader(HEADER_REQUEST_ID);
        String requestId = (incoming != null && SAFE_REQUEST_ID.matcher(incoming).matches())
                ? incoming
                : UUID.randomUUID().toString();
        MDC.put(MDC_REQUEST_ID, requestId);
        response.setHeader(HEADER_REQUEST_ID, requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            // clear ALL MDC keys, not just requestId. Future filters (JWT auth) may
            // add userId/coupleId; if any of them throw before cleaning up their own
            // entries we still leave a clean slate for the next request.
            MDC.clear();
        }
    }
}
