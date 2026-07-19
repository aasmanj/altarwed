package com.altarwed.infrastructure.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Boot-time announcer for the Turnstile launch gate (issues #220 and #413).
 *
 * <p>{@link CloudflareTurnstileAdapter} fails open by design outside prod: with no secret
 * configured it verifies every request so local dev, CI, and any pre-Cloudflare environment keep
 * working. In the prod profile the adapter instead fails closed at request time
 * ({@code altarwed.turnstile.fail-closed=true} in application.yml's prod document): every
 * anonymous RSVP find-invitation call is rejected with a generic 503 until the secret exists, so
 * the human-check that #89's threat model assumes can never silently become a no-op.
 *
 * <p>History: the first cut of this class (issue #220) threw at boot, refusing to start prod with
 * a blank secret. Issue #413 replaced that with the request-level rejection above, per the
 * env-var rule in backend/CLAUDE.md: a missing var whose absence breaks one feature must degrade
 * that feature, never crash the JVM. Crashing here took down the entire API (wedding sites,
 * dashboards, Stripe webhooks) over one missing captcha secret; failing closed at the endpoint
 * keeps the blast radius to the single anonymous lookup the secret actually guards, while the
 * ERROR below plus the resulting 503s keep the outage loud rather than silent.
 *
 * <p>This bean's only job is to make the state unmissable in the boot log: ERROR when the prod
 * launch gate is unmet (secret blank while fail-closed), WARN when the captcha is intentionally
 * off (dev/test), silence when configured.
 */
@Component
public class TurnstileStartupValidator implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(TurnstileStartupValidator.class);

    static final String LAUNCH_GATE_UNMET_MESSAGE =
            "LAUNCH GATE UNMET (issue #413): TURNSTILE_SECRET_KEY is blank while "
                    + "altarwed.turnstile.fail-closed=true (prod profile). Anonymous RSVP "
                    + "find-invitation is FAILING CLOSED: every guest lookup returns 503 until the "
                    + "secret is set. Set TURNSTILE-SECRET-KEY in altarwed-prod-kv and confirm the "
                    + "TURNSTILE_SECRET_KEY App Service setting references it (issue #247), then "
                    + "restart. The rest of the app serves normally.";

    private final boolean failClosed;
    private final String secretKey;

    public TurnstileStartupValidator(
            @Value("${altarwed.turnstile.fail-closed:false}") boolean failClosed,
            @Value("${altarwed.turnstile.secret-key:}") String secretKey) {
        this.failClosed = failClosed;
        this.secretKey = secretKey;
    }

    /**
     * Boot-time verdict for a Turnstile secret. Package-visible and free of Spring/logging side
     * effects so all branches can be unit tested without a Spring context (SB4 removed the test
     * slices), mirroring {@code StartupConfigValidator.missingFeatureConfig}.
     */
    static TurnstileConfigStatus evaluate(boolean failClosed, String secretKey) {
        boolean configured = secretKey != null && !secretKey.isBlank();
        if (configured) {
            return TurnstileConfigStatus.CONFIGURED;
        }
        return failClosed ? TurnstileConfigStatus.MISSING_FAIL_CLOSED : TurnstileConfigStatus.MISSING_WARN;
    }

    /**
     * Runs during bean initialization so the verdict lands at the very top of the boot log. Never
     * throws: the fail-closed enforcement itself lives in {@link CloudflareTurnstileAdapter} at
     * request time, so the app boots and serves everything the secret does not guard.
     */
    @Override
    public void afterPropertiesSet() {
        switch (evaluate(failClosed, secretKey)) {
            case CONFIGURED -> {
                // Nothing to log: the control is active. The adapter owns per-request logging.
            }
            case MISSING_WARN -> log.warn(
                    "turnstile secret absent, captcha disabled for this profile, prod would fail closed");
            case MISSING_FAIL_CLOSED -> log.error(LAUNCH_GATE_UNMET_MESSAGE);
        }
    }

    enum TurnstileConfigStatus {
        CONFIGURED,
        MISSING_WARN,
        MISSING_FAIL_CLOSED
    }
}
