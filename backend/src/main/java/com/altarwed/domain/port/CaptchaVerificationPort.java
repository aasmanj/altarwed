package com.altarwed.domain.port;

/**
 * Verifies a client-supplied challenge token (e.g. Cloudflare Turnstile) proves
 * a human, not a script, made the request. An implementation with no provider
 * configured should verify() everything and log a WARN once at startup rather
 * than blocking the feature it protects (see CloudflareTurnstileAdapter).
 */
public interface CaptchaVerificationPort {
    boolean verify(String token, String remoteIp);
}
