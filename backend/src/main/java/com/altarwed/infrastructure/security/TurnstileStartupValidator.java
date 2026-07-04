package com.altarwed.infrastructure.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Refuses to boot the prod profile when {@code TURNSTILE_SECRET_KEY} is blank.
 *
 * <p>{@link CloudflareTurnstileAdapter} fails open by design: with no secret configured it verifies
 * every request so local dev and any pre-Cloudflare environment keep working. That ergonomic default
 * is also a silent-regression risk (issue #220): if the secret ever goes missing in prod, the RSVP
 * find-invitation captcha that guards against scripted guest-list enumeration and RSVP-token minting
 * (issue #89) stops existing with nothing failing and nothing logging loudly.
 *
 * <p>This guard closes that hole at the boot boundary without touching the adapter's runtime
 * behavior. In the {@code prod} profile a blank secret aborts context startup with an actionable
 * message, so a fail-open prod is impossible: the app never serves traffic with the control off. In
 * every other profile a blank secret is still the intended state, so it logs a single WARN and
 * proceeds.
 *
 * <p>It sits beside the adapter (a security control) rather than in
 * {@link com.altarwed.infrastructure.observability.StartupConfigValidator}, which only WARNs for
 * feature-degrading vars (email, Sheets, blob, checkout) whose absence must never crash the JVM. The
 * Turnstile secret is different: in prod its absence disables a security control, so fail-closed at
 * boot is the correct posture, not a warning.
 */
@Component
public class TurnstileStartupValidator implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(TurnstileStartupValidator.class);

    static final String MISSING_IN_PROD_MESSAGE =
            "TURNSTILE_SECRET_KEY is blank in the prod profile. The RSVP find-invitation captcha "
                    + "(issue #89) would fail open, disabling scripted guest-list enumeration "
                    + "protection. Set TURNSTILE-SECRET-KEY in altarwed-prod-kv and confirm the "
                    + "TURNSTILE_SECRET_KEY App Service setting references it, then redeploy. "
                    + "Refusing to start.";

    private final boolean prodProfile;
    private final String secretKey;

    public TurnstileStartupValidator(
            Environment environment,
            @Value("${altarwed.turnstile.secret-key:}") String secretKey) {
        this.prodProfile = environment.matchesProfiles("prod");
        this.secretKey = secretKey;
    }

    /**
     * Boot-time verdict for a Turnstile secret. Package-visible and free of Spring/logging side
     * effects so both branches can be unit tested without a Spring context (SB4 removed the test
     * slices), mirroring {@code StartupConfigValidator.missingFeatureConfig}.
     */
    static TurnstileConfigStatus evaluate(boolean prodProfile, String secretKey) {
        boolean configured = secretKey != null && !secretKey.isBlank();
        if (configured) {
            return TurnstileConfigStatus.CONFIGURED;
        }
        return prodProfile ? TurnstileConfigStatus.MISSING_FATAL : TurnstileConfigStatus.MISSING_WARN;
    }

    /**
     * Runs during bean initialization (before the web server accepts traffic), so a fatal verdict
     * aborts context refresh and the app never boots with the captcha silently disabled.
     */
    @Override
    public void afterPropertiesSet() {
        switch (evaluate(prodProfile, secretKey)) {
            case CONFIGURED -> {
                // Nothing to log: the control is active. The adapter owns per-request logging.
            }
            case MISSING_WARN -> log.warn(
                    "turnstile secret absent, captcha disabled for this profile, prod boot would be refused");
            case MISSING_FATAL -> throw new IllegalStateException(MISSING_IN_PROD_MESSAGE);
        }
    }

    enum TurnstileConfigStatus {
        CONFIGURED,
        MISSING_WARN,
        MISSING_FATAL
    }
}
