package com.altarwed.web.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link AuthOriginGuard} (issue #116).
 *
 * The guard is a plain component fed the CORS allowed-origins string, so this is a
 * Spring-free unit test using MockHttpServletRequest. Pins the full policy: allowed
 * Origin passes, foreign Origin is rejected, Referer is the fallback when Origin is
 * absent, absence of both headers is allowed (non-browser clients are not the CSRF
 * threat), and normalization quirks (case, trailing slash, default ports) do not
 * lock legitimate browsers out.
 */
class AuthOriginGuardTest {

    private final AuthOriginGuard guard = new AuthOriginGuard(
            "https://altarwed.com,https://www.altarwed.com,https://app.altarwed.com,http://localhost:5173");

    private MockHttpServletRequest request() {
        return new MockHttpServletRequest("POST", "/api/v1/auth/refresh");
    }

    // Allowed origins pass

    @Test
    void allowedOrigin_passes() {
        var req = request();
        req.addHeader("Origin", "https://app.altarwed.com");
        assertThatCode(() -> guard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }

    @Test
    void allowedDevOrigin_passes() {
        var req = request();
        req.addHeader("Origin", "http://localhost:5173");
        assertThatCode(() -> guard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }

    @Test
    void allowedOrigin_uppercaseAndTrailingSlash_passes() {
        var req = request();
        req.addHeader("Origin", "HTTPS://App.AltarWed.com/");
        assertThatCode(() -> guard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }

    @Test
    void allowedOrigin_explicitDefaultPort_passes() {
        var req = request();
        req.addHeader("Origin", "https://app.altarwed.com:443");
        assertThatCode(() -> guard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }

    @Test
    void allowedOrigin_explicitHttpDefaultPort_passes() {
        var httpGuard = new AuthOriginGuard("http://dev.altarwed.local");
        var req = request();
        req.addHeader("Origin", "http://dev.altarwed.local:80");
        assertThatCode(() -> httpGuard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }

    @Test
    void allowedOrigin_absoluteFqdnTrailingDot_passes() {
        // "app.altarwed.com." is the absolute-FQDN spelling of the same host.
        var req = request();
        req.addHeader("Origin", "https://app.altarwed.com.");
        assertThatCode(() -> guard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }

    // Foreign origins are rejected

    @Test
    void foreignOrigin_isRejected() {
        var req = request();
        req.addHeader("Origin", "https://evil.example");
        assertThatThrownBy(() -> guard.assertTrustedOrigin(req, "refresh"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void lookalikeSubdomainOrigin_isRejected() {
        var req = request();
        req.addHeader("Origin", "https://app.altarwed.com.evil.example");
        assertThatThrownBy(() -> guard.assertTrustedOrigin(req, "refresh"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void schemeDowngradeOrigin_isRejected() {
        // http:// version of an allowed https:// origin is a different origin.
        var req = request();
        req.addHeader("Origin", "http://app.altarwed.com");
        assertThatThrownBy(() -> guard.assertTrustedOrigin(req, "refresh"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void opaqueNullOrigin_isRejected() {
        // Sandboxed iframes / data: URLs send the literal string "null".
        var req = request();
        req.addHeader("Origin", "null");
        assertThatThrownBy(() -> guard.assertTrustedOrigin(req, "logout"))
                .isInstanceOf(AccessDeniedException.class);
    }

    // Referer fallback (Origin absent)

    @Test
    void allowedReferer_withoutOrigin_passes() {
        var req = request();
        req.addHeader("Referer", "https://app.altarwed.com/dashboard/guests?tab=rsvp");
        assertThatCode(() -> guard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }

    @Test
    void foreignReferer_withoutOrigin_isRejected() {
        var req = request();
        req.addHeader("Referer", "https://evil.example/csrf.html");
        assertThatThrownBy(() -> guard.assertTrustedOrigin(req, "refresh"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void refererWithExplicitPort_isComparedByOrigin() {
        var req = request();
        req.addHeader("Referer", "http://localhost:5173/login");
        assertThatCode(() -> guard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }

    @Test
    void userinfoTrickInReferer_isRejected() {
        // https://app.altarwed.com@evil.example puts the trusted host in the userinfo
        // part; the real host is evil.example. URI.getHost() must not be fooled.
        var req = request();
        req.addHeader("Referer", "https://app.altarwed.com@evil.example/csrf.html");
        assertThatThrownBy(() -> guard.assertTrustedOrigin(req, "refresh"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void blankOrigin_fallsThroughToReferer() {
        // A blank Origin asserts nothing; the foreign Referer must still be caught.
        var req = request();
        req.addHeader("Origin", "");
        req.addHeader("Referer", "https://evil.example/csrf.html");
        assertThatThrownBy(() -> guard.assertTrustedOrigin(req, "refresh"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void originHeaderWins_whenBothPresent() {
        // A cross-site browser POST carries the attacker page's Origin even if the
        // Referer were somehow trusted; Origin is authoritative when present.
        var req = request();
        req.addHeader("Origin", "https://evil.example");
        req.addHeader("Referer", "https://app.altarwed.com/dashboard");
        assertThatThrownBy(() -> guard.assertTrustedOrigin(req, "refresh"))
                .isInstanceOf(AccessDeniedException.class);
    }

    // Absent / degenerate headers are allowed by design (see AuthOriginGuard javadoc)

    @Test
    void noOriginAndNoReferer_passes() {
        // curl, mobile clients, older same-origin browsers. Browsers attach Origin to
        // cross-site POSTs, so absence is not evidence of a cross-site request.
        assertThatCode(() -> guard.assertTrustedOrigin(request(), "refresh")).doesNotThrowAnyException();
    }

    @Test
    void unparseableReferer_withoutOrigin_passes() {
        // A hand-crafted client could omit the header entirely, so rejecting malformed
        // values closes no attack path; treat as absent.
        var req = request();
        req.addHeader("Referer", "not a url ::: %%%");
        assertThatCode(() -> guard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }

    @Test
    void relativeReferer_withoutOrigin_passes() {
        // Parses as a URI but has no scheme/host, so no origin can be asserted.
        var req = request();
        req.addHeader("Referer", "/dashboard");
        assertThatCode(() -> guard.assertTrustedOrigin(req, "refresh")).doesNotThrowAnyException();
    }
}
