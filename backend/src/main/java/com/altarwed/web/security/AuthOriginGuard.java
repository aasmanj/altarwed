package com.altarwed.web.security;

import com.altarwed.infrastructure.observability.LogSanitizer;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * CSRF guard for the two auth endpoints that act on the httpOnly refresh cookie
 * ({@code POST /api/v1/auth/refresh} and {@code POST /api/v1/auth/logout}), issue #116.
 *
 * Threat model: CSRF protection is disabled for this stateless REST API (correct for
 * JWT-in-header endpoints, which a foreign site cannot forge), but the refresh token rides
 * a cookie that prod sets {@code SameSite=None} (SPA and API are cross-site). A malicious
 * page can therefore fire a credentialed cross-site POST at refresh/logout. Impact is
 * limited to forced logout / forced token rotation (the response body is unreadable
 * cross-origin), but it is still an unauthenticated attacker driving an authenticated
 * state change, so we validate the browser-asserted request origin.
 *
 * Policy:
 * <ul>
 *   <li>{@code Origin} header present: its value must be one of the configured CORS
 *       allowed origins. Same property ({@code altarwed.cors.allowed-origins}) as
 *       {@code SecurityConfig}, one source of truth, no second list to drift.</li>
 *   <li>No {@code Origin}: fall back to the {@code Referer} header's origin part.
 *       Some privacy proxies and older browsers strip Origin but keep Referer.</li>
 *   <li>Neither header present: ALLOW. Absence is not evidence of a cross-site call;
 *       browsers always attach Origin to cross-site POSTs, so a header-less request is
 *       curl, a mobile client, or an old same-origin browser, none of which are the
 *       CSRF threat this guard exists for. Blocking them would break legitimate
 *       non-browser clients while stopping no real attack (a non-browser attacker
 *       cannot obtain the victim's cookie anyway).</li>
 *   <li>Unparseable Referer (with no Origin): treated as absent, i.e. ALLOW. Real
 *       browsers send well-formed headers; a hand-crafted client could simply omit the
 *       header instead, so rejecting malformed values adds a failure mode without
 *       closing any attack path.</li>
 *   <li>{@code Origin: null} (sandboxed iframe, data: URL, some redirect chains) is an
 *       opaque origin, never in the allowed set, so it is rejected. A sandboxed page is
 *       exactly the kind of untrusted context this guard should stop.</li>
 * </ul>
 *
 * Rejections WARN-log the offending origin (attacker-influenced text, so sanitized; not
 * PII) as the security-audit trail and throw {@link AccessDeniedException}, mapped to a
 * clean 403 by {@code GlobalExceptionHandler}, same pattern as {@link CoupleAccessGuard}.
 */
@Component
public class AuthOriginGuard {

    private static final Logger log = LoggerFactory.getLogger(AuthOriginGuard.class);

    private final Set<String> allowedOrigins;

    public AuthOriginGuard(@Value("${altarwed.cors.allowed-origins}") String allowedOrigins) {
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(AuthOriginGuard::normalize)
                .filter(o -> !o.isBlank())
                .collect(Collectors.toUnmodifiableSet());
    }

    /**
     * Rejects the request with {@link AccessDeniedException} (403) when a browser-asserted
     * origin is present and not in the CORS allowed set. See class javadoc for the policy.
     *
     * @param endpoint short label for the security log, e.g. "refresh" or "logout"
     */
    public void assertTrustedOrigin(HttpServletRequest request, String endpoint) {
        String headerSource;
        String candidate;

        String origin = request.getHeader(HttpHeaders.ORIGIN);
        if (origin != null && !origin.isBlank()) {
            headerSource = "Origin";
            candidate = origin;
        } else {
            Optional<String> refererOrigin = Optional
                    .ofNullable(request.getHeader(HttpHeaders.REFERER))
                    .flatMap(AuthOriginGuard::originOf);
            if (refererOrigin.isEmpty()) {
                // Neither header (or an unparseable Referer): allowed by design, see javadoc.
                return;
            }
            headerSource = "Referer";
            candidate = refererOrigin.get();
        }

        if (!allowedOrigins.contains(normalize(candidate))) {
            log.warn("cross-site auth request rejected, endpoint={}, headerSource={}, origin={}",
                    endpoint, headerSource, LogSanitizer.stripControlChars(candidate));
            throw new AccessDeniedException("Access denied");
        }
    }

    /** Extracts the scheme://host[:port] origin of a URL, empty when unparseable. */
    private static Optional<String> originOf(String url) {
        try {
            URI uri = new URI(url.trim());
            if (uri.getScheme() == null || uri.getHost() == null) {
                return Optional.empty();
            }
            String port = uri.getPort() == -1 ? "" : ":" + uri.getPort();
            return Optional.of(uri.getScheme() + "://" + uri.getHost() + port);
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
    }

    /**
     * Canonical form for comparison: trimmed, lowercase, no trailing slash, default
     * ports dropped (browsers send "https://host", config might say "https://host:443").
     */
    private static String normalize(String origin) {
        String o = origin.trim().toLowerCase(Locale.ROOT);
        while (o.endsWith("/")) {
            o = o.substring(0, o.length() - 1);
        }
        if (o.startsWith("https://") && o.endsWith(":443")) {
            o = o.substring(0, o.length() - 4);
        } else if (o.startsWith("http://") && o.endsWith(":80")) {
            o = o.substring(0, o.length() - 3);
        }
        // A trailing dot is the absolute-FQDN form of the same host ("app.altarwed.com.").
        // Without this a legit user hitting the dashboard via the FQDN form would get a
        // spurious 403 (fails closed, but still a needless lockout).
        if (o.endsWith(".")) {
            o = o.substring(0, o.length() - 1);
        }
        return o;
    }
}
