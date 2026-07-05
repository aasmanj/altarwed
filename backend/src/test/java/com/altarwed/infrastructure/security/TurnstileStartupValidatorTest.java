package com.altarwed.infrastructure.security;

import com.altarwed.infrastructure.security.TurnstileStartupValidator.TurnstileConfigStatus;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TurnstileStartupValidatorTest {

    // --- Pure verdict logic (no Spring context) ---

    @Test
    void prodProfileWithBlankSecretIsFatal() {
        assertSame(TurnstileConfigStatus.MISSING_FATAL, TurnstileStartupValidator.evaluate(true, ""));
        assertSame(TurnstileConfigStatus.MISSING_FATAL, TurnstileStartupValidator.evaluate(true, "   "));
        assertSame(TurnstileConfigStatus.MISSING_FATAL, TurnstileStartupValidator.evaluate(true, null));
    }

    @Test
    void prodProfileWithConfiguredSecretIsOk() {
        assertSame(TurnstileConfigStatus.CONFIGURED, TurnstileStartupValidator.evaluate(true, "secret"));
    }

    @Test
    void nonProdProfileWithBlankSecretWarnsButProceeds() {
        assertSame(TurnstileConfigStatus.MISSING_WARN, TurnstileStartupValidator.evaluate(false, ""));
        assertSame(TurnstileConfigStatus.MISSING_WARN, TurnstileStartupValidator.evaluate(false, null));
    }

    @Test
    void nonProdProfileWithConfiguredSecretIsOk() {
        assertSame(TurnstileConfigStatus.CONFIGURED, TurnstileStartupValidator.evaluate(false, "secret"));
    }

    // --- Boot-boundary behavior (afterPropertiesSet is invoked during context refresh) ---

    @Test
    void afterPropertiesSetFailsBootInProdWhenSecretBlank() {
        MockEnvironment env = new MockEnvironment().withProperty("spring.profiles.active", "prod");
        env.setActiveProfiles("prod");
        TurnstileStartupValidator validator = new TurnstileStartupValidator(env, "");

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::afterPropertiesSet);
        assertEquals(TurnstileStartupValidator.MISSING_IN_PROD_MESSAGE, ex.getMessage());
        // Actionable message points at the Key Vault secret and the App Service setting.
        assertTrue(ex.getMessage().contains("altarwed-prod-kv"));
        assertTrue(ex.getMessage().contains("TURNSTILE"));
    }

    @Test
    void afterPropertiesSetBootsInProdWhenSecretPresent() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");
        TurnstileStartupValidator validator = new TurnstileStartupValidator(env, "a-real-secret");

        assertDoesNotThrow(validator::afterPropertiesSet);
    }

    @Test
    void afterPropertiesSetBootsInDevWhenSecretBlank() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("local");
        TurnstileStartupValidator validator = new TurnstileStartupValidator(env, "");

        assertDoesNotThrow(validator::afterPropertiesSet);
    }
}
