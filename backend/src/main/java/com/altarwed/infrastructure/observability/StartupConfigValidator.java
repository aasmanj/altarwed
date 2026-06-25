package com.altarwed.infrastructure.observability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Warns at startup when a feature-scoped secret is absent.
 *
 * <p>These vars carry an empty default ({@code ${X:}}) in application.yml so a missing one
 * degrades a single feature at runtime (email, Google Sheets sync, blob/media) instead of
 * crashing the JVM at startup before the health endpoint exists. That 503-no-logs failure
 * mode is the incident class documented in backend/CLAUDE.md (2026-06-05).
 *
 * <p>Truly fatal vars (DB url/credentials, JWT secret) keep NO default and are intentionally
 * NOT checked here: the app cannot function without them, so they must fail loud at startup.
 */
@Component
public class StartupConfigValidator {

    private static final Logger log = LoggerFactory.getLogger(StartupConfigValidator.class);

    // Insertion order is preserved so the WARN line lists names in a stable, readable order.
    private final Map<String, String> featureConfig;

    public StartupConfigValidator(
            @Value("${altarwed.resend.api-key:}") String resendApiKey,
            @Value("${altarwed.google.client-id:}") String googleClientId,
            @Value("${altarwed.google.client-secret:}") String googleClientSecret,
            @Value("${altarwed.azure.storage.connection-string:}") String azureStorageConnectionString
    ) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("RESEND_API_KEY", resendApiKey);
        m.put("GOOGLE_OAUTH_CLIENT_ID", googleClientId);
        m.put("GOOGLE_OAUTH_CLIENT_SECRET", googleClientSecret);
        m.put("AZURE_STORAGE_CONNECTION_STRING", azureStorageConnectionString);
        this.featureConfig = m;
    }

    /**
     * Names of the feature-scoped vars that are absent or blank. Package-visible so the
     * detection logic can be unit tested without a Spring context (SB4 removed the test slices).
     */
    List<String> missingFeatureConfig() {
        List<String> missing = new ArrayList<>();
        featureConfig.forEach((name, value) -> {
            if (value == null || value.isBlank()) {
                missing.add(name);
            }
        });
        return missing;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warnOnMissingConfig() {
        List<String> missing = missingFeatureConfig();
        if (missing.isEmpty()) {
            return;
        }
        // One aggregate WARN (not one per var) keeps App Insights cost down and avoids warning
        // fatigue. The app is up and healthy; each named var simply disables one integration
        // until it is set. No secret values are logged, only the variable names.
        log.warn("feature config absent at startup, listed integrations disabled until set, missing={}", missing);
    }
}
