package com.altarwed.web.security;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.util.WebUtils;

import java.util.Optional;

@Component
public class CookieService {

    private static final Logger log = LoggerFactory.getLogger(CookieService.class);

    static final String REFRESH_COOKIE_NAME = "altarwed_rt";

    // Path-scoped so the browser only sends this cookie to auth endpoints,
    // not to every API call. Minimises attack surface beyond HttpOnly alone.
    private static final String COOKIE_PATH = "/api/v1/auth";

    @Value("${altarwed.cookie.secure:false}")
    private boolean secure;

    // Default Strict works in dev (localhost is same-site). Prod sets this to
    // None via COOKIE_SAME_SITE env var because the SPA (app.altarwed.com) and
    // API (altarwed-prod-api.azurewebsites.net) are cross-site; Strict would
    // silently drop the cookie on every refresh call.
    @Value("${altarwed.cookie.same-site:Strict}")
    private String sameSite;

    @Value("${altarwed.cors.allowed-origins}")
    private String corsAllowedOrigins;

    @PostConstruct
    public void validateCookieConfig() {
        if ("Strict".equalsIgnoreCase(sameSite) && corsAllowedOrigins.contains(".com")) {
            log.warn("cookie misconfigured for production: sameSite=Strict with cross-origin " +
                    "allowed origins; refresh token cookie will be silently dropped by browsers; " +
                    "set COOKIE_SAME_SITE=None and COOKIE_SECURE=true in Azure App Service");
        }
    }

    // Creates a session cookie (no Max-Age / Expires) so the browser discards
    // it when the browser process exits. Survives tab close within the same session.
    public ResponseCookie createRefreshCookie(String rawToken) {
        return baseBuilder(rawToken).build();
    }

    // Returns a zero-lifetime cookie that tells the browser to delete altarwed_rt.
    // Must share the same Path/SameSite/Secure attributes as createRefreshCookie
    // so the browser recognises it as the same cookie and removes it.
    public ResponseCookie clearRefreshCookie() {
        return baseBuilder("").maxAge(0).build();
    }

    public Optional<String> extractRefreshToken(HttpServletRequest request) {
        return Optional.ofNullable(WebUtils.getCookie(request, REFRESH_COOKIE_NAME))
                .map(Cookie::getValue)
                .filter(v -> !v.isBlank());
    }

    private ResponseCookie.ResponseCookieBuilder baseBuilder(String value) {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, value)
                .httpOnly(true)
                .secure(secure)
                .path(COOKIE_PATH)
                .sameSite(sameSite);
    }
}
