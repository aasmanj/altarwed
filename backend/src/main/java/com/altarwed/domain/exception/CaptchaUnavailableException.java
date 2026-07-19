package com.altarwed.domain.exception;

/**
 * The captcha control is required in this environment (prod fail-closed, issue #413) but has no
 * secret configured, so the request it guards cannot be verified and must be rejected. Distinct
 * from {@link CaptchaVerificationFailedException}: that one means the caller's token failed the
 * challenge (retry with a fresh token can succeed); this one means the server side is
 * misconfigured and no retry will succeed until an operator sets the secret.
 *
 * <p>This message is internal (logs only). The web layer maps this to a generic 503 that never
 * mentions captcha or configuration, so the response is not an oracle for which defense is down.
 */
public class CaptchaUnavailableException extends RuntimeException {
    public CaptchaUnavailableException() {
        super("Captcha verification is required but no secret is configured; failing closed");
    }
}
