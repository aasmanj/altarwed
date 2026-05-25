package com.altarwed.web.controller;

import com.altarwed.application.dto.GoogleAuthUrlResponse;
import com.altarwed.application.dto.GoogleOAuthStatusResponse;
import com.altarwed.application.service.GoogleOAuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/integrations/google-sheets")
public class GoogleSheetsIntegrationController {

    private static final Logger log = LoggerFactory.getLogger(GoogleSheetsIntegrationController.class);

    private final GoogleOAuthService googleOAuthService;

    public GoogleSheetsIntegrationController(GoogleOAuthService googleOAuthService) {
        this.googleOAuthService = googleOAuthService;
    }

    /**
     * Returns the Google OAuth URL. Frontend redirects the browser here.
     * The principal is the authenticated couple's email string (set by JwtAuthenticationFilter).
     */
    @GetMapping("/auth-url")
    public ResponseEntity<GoogleAuthUrlResponse> getAuthUrl(
            @AuthenticationPrincipal String email
    ) {
        UUID coupleId = googleOAuthService.getCoupleIdByEmail(email);
        log.info("google sheets auth url requested, coupleId={}", coupleId);
        return ResponseEntity.ok(googleOAuthService.generateAuthUrl(coupleId));
    }

    /**
     * Public callback endpoint -- Google redirects here after the user approves.
     * Exchanges the code for tokens and redirects back to the frontend.
     * No authentication required: the state token carries the coupleId.
     */
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam String code,
            @RequestParam String state
    ) {
        String redirectUrl = googleOAuthService.handleCallback(code, state);
        return ResponseEntity.status(302)
                .location(URI.create(redirectUrl))
                .build();
    }

    /** Returns whether this couple has a connected Google account. */
    @GetMapping("/status")
    public ResponseEntity<GoogleOAuthStatusResponse> getStatus(
            @AuthenticationPrincipal String email
    ) {
        UUID coupleId = googleOAuthService.getCoupleIdByEmail(email);
        return ResponseEntity.ok(googleOAuthService.getStatus(coupleId));
    }

    /** Revokes and deletes the stored Google OAuth tokens. */
    @DeleteMapping
    public ResponseEntity<Void> disconnect(
            @AuthenticationPrincipal String email
    ) {
        UUID coupleId = googleOAuthService.getCoupleIdByEmail(email);
        log.info("google oauth disconnect requested, coupleId={}", coupleId);
        googleOAuthService.disconnect(coupleId);
        return ResponseEntity.noContent().build();
    }
}
