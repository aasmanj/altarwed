package com.altarwed.infrastructure.observability;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StartupConfigValidatorTest {

    @Test
    void reportsNothingWhenAllFeatureConfigPresent() {
        StartupConfigValidator validator = new StartupConfigValidator(
                "resend-key", "google-id", "google-secret", "azure-conn", "price_monthly", "price_annual");

        assertTrue(validator.missingFeatureConfig().isEmpty());
    }

    @Test
    void reportsBlankNullAndWhitespaceByNameInDeclaredOrder() {
        // Empty, present, whitespace-only, null, present, and blank respectively.
        StartupConfigValidator validator = new StartupConfigValidator(
                "", "google-id", "   ", null, "price_monthly", "");

        assertEquals(
                List.of("RESEND_API_KEY", "GOOGLE_OAUTH_CLIENT_SECRET", "AZURE_STORAGE_CONNECTION_STRING",
                        "STRIPE_PRICE_PRO_ANNUAL"),
                validator.missingFeatureConfig());
    }

    // Issue #45: a blank Stripe price var now blocks 100% of vendor checkouts (fail-closed
    // allow-list), not just a webhook-side tier misclassification, so it must be reported here.
    @Test
    void reportsBothStripePriceVarsWhenBothAreBlank() {
        StartupConfigValidator validator = new StartupConfigValidator(
                "resend-key", "google-id", "google-secret", "azure-conn", "", null);

        assertEquals(
                List.of("STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_ANNUAL"),
                validator.missingFeatureConfig());
    }
}
