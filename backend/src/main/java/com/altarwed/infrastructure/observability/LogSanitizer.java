package com.altarwed.infrastructure.observability;

/**
 * Helpers for emitting low-PII identifiers in audit logs without violating
 * GDPR/CCPA, which classify log files as data stores.
 *
 * When you need to log "user X failed login" or "user Y reset their password"
 * for security-audit purposes, do NOT log the raw email. Use {@link #maskEmail}
 * to emit a partial form (j***@altarwed.com) that is still useful for support
 * but not a full PII disclosure.
 *
 * For everything else, prefer the internal UUID. The DB has the join when you
 * truly need to know who.
 */
public final class LogSanitizer {
    private LogSanitizer() {}

    /**
     * Masks an email address to log-safe form. Keeps the first character and
     * the domain so support can still cross-reference, but hides the rest.
     *
     * <pre>
     * "jordan@altarwed.com"  -> "j***@altarwed.com"
     * "a@b.co"               -> "a***@b.co"
     * null / blank           -> "(blank)"
     * "no-at-sign"           -> "(invalid)"
     * </pre>
     */
    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) return "(blank)";
        int at = email.indexOf('@');
        if (at <= 0 || at == email.length() - 1) return "(invalid)";
        return email.charAt(0) + "***" + email.substring(at);
    }
}
