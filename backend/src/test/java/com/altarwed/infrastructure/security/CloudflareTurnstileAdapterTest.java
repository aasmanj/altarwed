package com.altarwed.infrastructure.security;

import com.altarwed.domain.exception.CaptchaUnavailableException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

/**
 * Covers the graceful-degradation paths that don't require a real network call
 * to Cloudflare. The "verify a real token" path is exercised end to end by
 * GuestServiceTest via the mocked CaptchaVerificationPort; this class proves
 * the adapter itself behaves correctly when unconfigured, in both the fail-open
 * (dev/CI, issue #89) and fail-closed (prod, issue #413) profiles.
 */
class CloudflareTurnstileAdapterTest {

    private static final boolean FAIL_OPEN = false;
    private static final boolean FAIL_CLOSED = true;

    @Test
    void verifiesEverythingWhenNoSecretKeyIsConfiguredInAFailOpenProfile() {
        // Local/dev/CI, or before the Cloudflare Turnstile site exists: captcha must not
        // block the RSVP find-invitation feature just because it isn't set up yet.
        CloudflareTurnstileAdapter adapter = new CloudflareTurnstileAdapter("", FAIL_OPEN);

        assertThat(adapter.verify(null, "203.0.113.1")).isTrue();
        assertThat(adapter.verify("", "203.0.113.1")).isTrue();
        assertThat(adapter.verify("anything", "203.0.113.1")).isTrue();
    }

    @Test
    void rejectsEveryRequestWhenNoSecretKeyIsConfiguredInAFailClosedProfile() {
        // Prod (issue #413): a blank secret must be a loud, scoped outage of this one
        // endpoint, never a silent removal of the human-check. Every token shape is
        // rejected identically, so the response gives no oracle about configuration.
        CloudflareTurnstileAdapter adapter = new CloudflareTurnstileAdapter("", FAIL_CLOSED);

        assertThatExceptionOfType(CaptchaUnavailableException.class)
                .isThrownBy(() -> adapter.verify(null, "203.0.113.1"));
        assertThatExceptionOfType(CaptchaUnavailableException.class)
                .isThrownBy(() -> adapter.verify("", "203.0.113.1"));
        assertThatExceptionOfType(CaptchaUnavailableException.class)
                .isThrownBy(() -> adapter.verify("a-plausible-token", "203.0.113.1"));
    }

    @Test
    void rejectsAMissingTokenOnceASecretKeyIsConfigured() {
        // Once Turnstile is actually configured, a request with no token at all must
        // fail closed rather than silently pass through unchecked.
        CloudflareTurnstileAdapter adapter = new CloudflareTurnstileAdapter("test-secret-key", FAIL_OPEN);

        assertThat(adapter.verify(null, "203.0.113.1")).isFalse();
        assertThat(adapter.verify("", "203.0.113.1")).isFalse();
        assertThat(adapter.verify("   ", "203.0.113.1")).isFalse();
    }

    @Test
    void configuredSecretBehavesTheSameInAFailClosedProfile() {
        // fail-closed only changes the unconfigured case: with a secret present, prod
        // verification is exactly the pre-#413 behavior (a missing token is a 400-style
        // false, not a 503-style throw).
        CloudflareTurnstileAdapter adapter = new CloudflareTurnstileAdapter("test-secret-key", FAIL_CLOSED);

        assertThat(adapter.verify(null, "203.0.113.1")).isFalse();
        assertThat(adapter.verify("", "203.0.113.1")).isFalse();
    }
}
