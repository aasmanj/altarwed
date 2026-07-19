package com.altarwed.domain.port;

import com.altarwed.domain.exception.CaptchaUnavailableException;

/**
 * Verifies a client-supplied challenge token (e.g. Cloudflare Turnstile) proves
 * a human, not a script, made the request. An implementation with no provider
 * configured should verify() everything and log a WARN once at startup rather
 * than blocking the feature it protects, EXCEPT where the environment declares
 * the control mandatory (prod fail-closed, issue #413): there it must throw
 * {@link CaptchaUnavailableException} so the caller is rejected without hinting
 * at server configuration (see CloudflareTurnstileAdapter).
 */
public interface CaptchaVerificationPort {
    /**
     * @return true if the token proves a human (or the control is intentionally off)
     * @throws CaptchaUnavailableException if the control is required but unconfigured
     */
    boolean verify(String token, String remoteIp);
}
