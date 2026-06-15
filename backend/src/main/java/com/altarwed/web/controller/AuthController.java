package com.altarwed.web.controller;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.LoginRequest;
import com.altarwed.application.dto.RegisterCoupleRequest;
import com.altarwed.application.service.AuthService;
import com.altarwed.domain.exception.InvalidRefreshTokenException;
import com.altarwed.web.security.CookieService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;
    private final CookieService cookieService;

    public AuthController(AuthService authService, CookieService cookieService) {
        this.authService = authService;
        this.cookieService = cookieService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterCoupleRequest request,
            HttpServletResponse response) {
        AuthResponse auth = authService.register(request);
        response.addHeader(HttpHeaders.SET_COOKIE, cookieService.createRefreshCookie(auth.refreshToken()).toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(auth);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        AuthResponse auth = authService.login(request);
        response.addHeader(HttpHeaders.SET_COOKIE, cookieService.createRefreshCookie(auth.refreshToken()).toString());
        return ResponseEntity.ok(auth);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        String rawRefreshToken = cookieService.extractRefreshToken(request).orElseThrow(() -> {
            log.warn("token refresh rejected, reason=cookie absent");
            return new InvalidRefreshTokenException();
        });
        AuthResponse auth = authService.refresh(rawRefreshToken);
        response.addHeader(HttpHeaders.SET_COOKIE, cookieService.createRefreshCookie(auth.refreshToken()).toString());
        return ResponseEntity.ok(auth);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        // Write the clear-cookie header unconditionally first so the browser
        // always loses the session cookie even if the DB call below throws.
        response.addHeader(HttpHeaders.SET_COOKIE, cookieService.clearRefreshCookie().toString());
        cookieService.extractRefreshToken(request).ifPresent(authService::logout);
        log.info("logout completed");
        return ResponseEntity.noContent().build();
    }
}
