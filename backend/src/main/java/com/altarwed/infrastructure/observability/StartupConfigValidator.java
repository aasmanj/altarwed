package com.altarwed.infrastructure.observability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Warns in prod at startup when one of the four feature-scoped secrets whose empty default this
 * change introduced is absent: RESEND_API_KEY, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
 * AZURE_STORAGE_CONNECTION_STRING.
 *
 * <p>Each carries an empty default ({@code ${X:}}) in application.yml so a missing one degrades a
 * single feature at runtime (email, Google Sheets sync, blob/media) instead of crashing the JVM at
 * startup before the health endpoint exists. That 503-no-logs failure mode is the incident class
 * documented in backend/CLAUDE.md (2026-06-05).
 *
 * <p>Scope is deliberately just those four. Truly fatal vars (DB url/credentials, JWT secret) keep
 * NO default and must fail loud, so they are not checked here. Other already-defaulted vars
 * (STRIPE_*, RESEND_WEBHOOK_SECRET, UNSUBSCRIBE_SECRET, ...) have their own fail-closed handling
 * where an empty value is a deliberate "reject" rather than "feature off", so warning about them
 * would be misleading; they are intentionally out of scope.
 *
 * <p>Gated to the {@code prod} profile: in local/CI these vars are normally unset, so warning there
 * is warning fatigue (backend/CLAUDE.md observability rule 12).
 */
@Component
@Profile("prod")
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
