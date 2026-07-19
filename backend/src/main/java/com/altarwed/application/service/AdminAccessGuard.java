package com.altarwed.application.service;

import com.altarwed.infrastructure.observability.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Single source of truth for the altarwed.admin.emails whitelist (issue #118).
 *
 * Owns the CSV parse, the email normalization (trim + lowercase, blank entries dropped)
 * and the fail-closed assertion every admin endpoint must call. Before this component
 * existed the parse and check were duplicated across three admin controllers and
 * AdminMetricsService, with small drifts (the service omitted blank-entry filtering and
 * did not WARN-log denials). Centralizing removes the drift and gives future admin
 * endpoints one obvious seam to call.
 *
 * Placement: application layer, not web.security, because AdminMetricsService (an
 * application service) also asserts admin access and application code must never import
 * web.*. Controllers may depend downward on application per the dependency rule.
 *
 * Behavior, all fail closed:
 * - null caller email denies (unauthenticated or token without a subject).
 * - Empty or missing property denies every caller and WARN-logs once at startup
 *   (env-var rule 1: safe default, degrade at runtime instead of crashing the JVM).
 * - Comparison is trim/lowercase on the whitelist side and lowercase on the caller
 *   side, exactly as the pre-existing checks did. Locale.ROOT makes the case fold
 *   deterministic regardless of the server's default locale.
 * - Denials throw AccessDeniedException, mapped to a detail-free 403 by
 *   GlobalExceptionHandler, and are WARN-logged with the masked email and the
 *   resource path (observability rules 6 and 8).
 */
@Component
public class AdminAccessGuard {

    private static final Logger log = LoggerFactory.getLogger(AdminAccessGuard.class);

    private final Set<String> adminEmails;

    public AdminAccessGuard(@Value("${altarwed.admin.emails:}") String adminEmailsCsv) {
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(","))
                .map(String::trim)
                .map(s -> s.toLowerCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
        if (this.adminEmails.isEmpty()) {
            log.warn("admin whitelist empty, all admin endpoints will deny access");
        }
    }

    /**
     * Controller-facing overload: extracts the principal email from the Authentication
     * (may be null on a misconfigured route) and delegates to the string check.
     */
    public void assertAdmin(Authentication auth, String resource) {
        assertAdmin(auth == null ? null : auth.getName(), resource);
    }

    /**
     * Asserts the caller is on the admin whitelist; throws AccessDeniedException (403)
     * otherwise. resource is a short path-like tag (for example "/api/v1/admin/vendors")
     * so the security-audit WARN says which admin surface was probed.
     */
    public void assertAdmin(String callerEmail, String resource) {
        if (callerEmail == null || !adminEmails.contains(callerEmail.toLowerCase(Locale.ROOT))) {
            log.warn("admin access denied, resource={}, maskedEmail={}", resource,
                    callerEmail != null ? LogSanitizer.maskEmail(callerEmail) : "null");
            throw new AccessDeniedException("Admin access required");
        }
    }
}
