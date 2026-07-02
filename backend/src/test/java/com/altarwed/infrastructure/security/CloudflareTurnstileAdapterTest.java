package com.altarwed.infrastructure.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the graceful-degradation paths that don't require a real network call
 * to Cloudflare. The "verify a real token" path is exercised end to end by
 * GuestServiceTest via the mocked CaptchaVerificationPort; this class proves
 * the adapter itself behaves correctly when unconfigured (issue #89).
 */
class CloudflareTurnstileAdapterTest {

    @Test
    void verifiesEverythingWhenNoSecretKeyIsConfigured() {
        // Local/dev, or before the Cloudflare Turnstile site exists: captcha must not
        // block the RSVP find-invitation feature just because it isn't set up yet.
        CloudflareTurnstileAdapter adapter = new CloudflareTurnstileAdapter("");

        assertThat(adapter.verify(null, "203.0.113.1")).isTrue();
        assertThat(adapter.verify("", "203.0.113.1")).isTrue();
        assertThat(adapter.verify("anything", "203.0.113.1")).isTrue();
    }

    @Test
    void rejectsAMissingTokenOnceASecretKeyIsConfigured() {
        // Once Turnstile is actually configured, a request with no token at all must
        // fail closed rather than silently pass through unchecked.
        CloudflareTurnstileAdapter adapter = new CloudflareTurnstileAdapter("test-secret-key");

        assertThat(adapter.verify(null, "203.0.113.1")).isFalse();
        assertThat(adapter.verify("", "203.0.113.1")).isFalse();
        assertThat(adapter.verify("   ", "203.0.113.1")).isFalse();
    }
}
