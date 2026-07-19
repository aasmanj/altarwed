package com.altarwed.web.controller;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.LoginRequest;
import com.altarwed.application.service.AuthService;
import com.altarwed.web.security.AuthOriginGuard;
import com.altarwed.web.security.CookieService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AuthController}'s origin guard wiring (issue #116).
 *
 * Controllers are plain classes, so this is a Mockito-only unit test (no Spring
 * context, no Docker). Pins that:
 *   - /refresh and /logout consult {@link AuthOriginGuard} BEFORE doing any token work,
 *     so a rejected cross-site request rotates nothing, revokes nothing, and (for
 *     logout) does not clear the cookie;
 *   - a passing guard leaves the existing happy paths untouched;
 *   - login and register never consult the guard (they are password-authenticated,
 *     not cookie-authenticated, so cross-site POSTs to them cannot ride a session).
 * The AccessDeniedException thrown on rejection is mapped to a 403 ProblemDetail by
 * GlobalExceptionHandler, same as CoupleAccessGuard rejections.
 */
class AuthControllerTest {

    private final AuthService authService = mock(AuthService.class);
    private final CookieService cookieService = mock(CookieService.class);
    private final AuthOriginGuard originGuard = mock(AuthOriginGuard.class);

    private final AuthController controller = new AuthController(authService, cookieService, originGuard);

    private final AuthResponse auth = AuthResponse.of(
            "access-token", "new-refresh-token", UUID.randomUUID(), "owner@example.com",
            "COUPLE", "Jordan", "Partner", LocalDate.of(2027, 6, 12), false);

    private static final ResponseCookie REFRESH_COOKIE =
            ResponseCookie.from("altarwed_rt", "new-refresh-token").build();
    private static final ResponseCookie CLEAR_COOKIE =
            ResponseCookie.from("altarwed_rt", "").maxAge(0).build();

    @Test
    void refresh_trustedOrigin_rotatesTokenAndSetsCookie() {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        when(cookieService.extractRefreshToken(request)).thenReturn(Optional.of("old-refresh-token"));
        when(authService.refresh("old-refresh-token")).thenReturn(auth);
        when(cookieService.createRefreshCookie("new-refresh-token")).thenReturn(REFRESH_COOKIE);

        ResponseEntity<AuthResponse> result = controller.refresh(request, response);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(result.getBody()).isEqualTo(auth);
        assertThat(response.getHeader(HttpHeaders.SET_COOKIE)).isEqualTo(REFRESH_COOKIE.toString());
        verify(originGuard).assertTrustedOrigin(request, "refresh");
    }

    @Test
    void refresh_foreignOrigin_rejectsBeforeAnyTokenWork() {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        doThrow(new AccessDeniedException("Access denied"))
                .when(originGuard).assertTrustedOrigin(request, "refresh");

        assertThatThrownBy(() -> controller.refresh(request, response))
                .isInstanceOf(AccessDeniedException.class);

        // Nothing rotated, nothing read, no cookie written.
        verifyNoInteractions(authService);
        verify(cookieService, never()).extractRefreshToken(any(HttpServletRequest.class));
        assertThat(response.getHeader(HttpHeaders.SET_COOKIE)).isNull();
    }

    @Test
    void logout_trustedOrigin_revokesTokenAndClearsCookie() {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        when(cookieService.extractRefreshToken(request)).thenReturn(Optional.of("old-refresh-token"));
        when(cookieService.clearRefreshCookie()).thenReturn(CLEAR_COOKIE);

        ResponseEntity<Void> result = controller.logout(request, response);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        // MockHttpServletResponse re-formats the Expires date, so assert the attributes
        // that matter (empty value + zero lifetime) rather than the exact string.
        assertThat(response.getHeader(HttpHeaders.SET_COOKIE))
                .startsWith("altarwed_rt=;")
                .contains("Max-Age=0");
        verify(authService).logout("old-refresh-token");
        verify(originGuard).assertTrustedOrigin(request, "logout");
    }

    @Test
    void logout_foreignOrigin_rejectsWithoutRevokingOrClearingCookie() {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        doThrow(new AccessDeniedException("Access denied"))
                .when(originGuard).assertTrustedOrigin(request, "logout");

        assertThatThrownBy(() -> controller.logout(request, response))
                .isInstanceOf(AccessDeniedException.class);

        // The forced-logout CSRF is exactly what the guard prevents: the victim's
        // refresh token stays valid and their cookie stays in place.
        verifyNoInteractions(authService);
        assertThat(response.getHeader(HttpHeaders.SET_COOKIE)).isNull();
    }

    @Test
    void login_doesNotConsultOriginGuard() {
        var response = new MockHttpServletResponse();
        when(authService.login(any())).thenReturn(auth);
        when(cookieService.createRefreshCookie(anyString())).thenReturn(REFRESH_COOKIE);

        ResponseEntity<AuthResponse> result = controller.login(
                new LoginRequest("owner@example.com", "pw"), response);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        verifyNoInteractions(originGuard);
    }
}
