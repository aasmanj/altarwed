package com.altarwed.infrastructure.security;

import com.altarwed.infrastructure.security.TurnstileStartupValidator.TurnstileConfigStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Issue #413 changed this validator's posture: a blank secret in a fail-closed (prod) profile is
 * no longer fatal at boot (that was #220's approach and it took the whole API down over one
 * missing captcha secret). It now logs the unmet launch gate at ERROR and lets the app serve;
 * the actual rejection happens per request in CloudflareTurnstileAdapter. These tests pin that
 * afterPropertiesSet never throws in any configuration.
 */
class TurnstileStartupValidatorTest {

    // --- Pure verdict logic (no Spring context) ---

    @Test
    void failClosedWithBlankSecretIsLaunchGateUnmet() {
        assertSame(TurnstileConfigStatus.MISSING_FAIL_CLOSED, TurnstileStartupValidator.evaluate(true, ""));
        assertSame(TurnstileConfigStatus.MISSING_FAIL_CLOSED, TurnstileStartupValidator.evaluate(true, "   "));
        assertSame(TurnstileConfigStatus.MISSING_FAIL_CLOSED, TurnstileStartupValidator.evaluate(true, null));
    }

    @Test
    void failClosedWithConfiguredSecretIsOk() {
        assertSame(TurnstileConfigStatus.CONFIGURED, TurnstileStartupValidator.evaluate(true, "secret"));
    }

    @Test
    void failOpenProfileWithBlankSecretWarnsButProceeds() {
        assertSame(TurnstileConfigStatus.MISSING_WARN, TurnstileStartupValidator.evaluate(false, ""));
        assertSame(TurnstileConfigStatus.MISSING_WARN, TurnstileStartupValidator.evaluate(false, null));
    }

    @Test
    void failOpenProfileWithConfiguredSecretIsOk() {
        assertSame(TurnstileConfigStatus.CONFIGURED, TurnstileStartupValidator.evaluate(false, "secret"));
    }

    // --- Boot-boundary behavior: never fatal, per the env-var rule in backend/CLAUDE.md ---

    @Test
    void afterPropertiesSetDoesNotThrowInFailClosedProfileWhenSecretBlank() {
        // The #220 behavior (IllegalStateException aborting context refresh) is intentionally
        // gone: a missing secret degrades the RSVP lookup, it must not crash the JVM (#413).
        TurnstileStartupValidator validator = new TurnstileStartupValidator(true, "");
        assertDoesNotThrow(validator::afterPropertiesSet);
    }

    @Test
    void afterPropertiesSetDoesNotThrowWhenConfigured() {
        TurnstileStartupValidator validator = new TurnstileStartupValidator(true, "a-real-secret");
        assertDoesNotThrow(validator::afterPropertiesSet);
    }

    @Test
    void afterPropertiesSetDoesNotThrowInFailOpenProfileWhenSecretBlank() {
        TurnstileStartupValidator validator = new TurnstileStartupValidator(false, "");
        assertDoesNotThrow(validator::afterPropertiesSet);
    }

    @Test
    void launchGateMessagePointsAtTheKeyVaultFixAndStaysOutOfHttpResponses() {
        // Operator-actionable: names the Key Vault secret, the App Service setting, and the
        // checklist issue. This string is log-only; the HTTP 503 body is asserted separately
        // (GlobalExceptionHandlerTest) to contain none of these details.
        String msg = TurnstileStartupValidator.LAUNCH_GATE_UNMET_MESSAGE;
        assertTrue(msg.contains("altarwed-prod-kv"));
        assertTrue(msg.contains("TURNSTILE_SECRET_KEY"));
        assertTrue(msg.contains("#247"));
        assertFalse(msg.contains("Refusing to start"));
    }
}
