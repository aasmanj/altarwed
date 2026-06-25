package com.altarwed.infrastructure.observability;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StartupConfigValidatorTest {

    @Test
    void reportsNothingWhenAllFeatureConfigPresent() {
        StartupConfigValidator validator = new StartupConfigValidator(
                "resend-key", "google-id", "google-secret", "azure-conn");

        assertTrue(validator.missingFeatureConfig().isEmpty());
    }

    @Test
    void reportsBlankNullAndWhitespaceByNameInDeclaredOrder() {
        // Empty, present, whitespace-only, and null respectively.
        StartupConfigValidator validator = new StartupConfigValidator(
                "", "google-id", "   ", null);

        assertEquals(
                List.of("RESEND_API_KEY", "GOOGLE_OAUTH_CLIENT_SECRET", "AZURE_STORAGE_CONNECTION_STRING"),
                validator.missingFeatureConfig());
    }
}
