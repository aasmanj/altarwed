package com.altarwed.application.service;

import com.altarwed.application.dto.GoogleAuthUrlResponse;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.GoogleOAuthTokenRepository;
import com.altarwed.domain.port.OAuthStateStorePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The state-store seam introduced by issue #109, tested at the service level with a mocked
 * port: issuing an auth URL must register exactly the state token embedded in that URL (with
 * the 10-minute TTL), and a callback whose state the store does not vouch for must be turned
 * away as {@code invalid_state} before any code-for-token exchange is attempted. Everything
 * else in the service is untouched by #109 and stays covered elsewhere.
 */
class GoogleOAuthServiceStateTest {

    private GoogleOAuthTokenRepository tokenRepository;
    private OAuthStateStorePort stateStore;
    private GoogleOAuthService service;

    @BeforeEach
    void setUp() {
        tokenRepository = mock(GoogleOAuthTokenRepository.class);
        stateStore = mock(OAuthStateStorePort.class);
        service = new GoogleOAuthService(tokenRepository, mock(CoupleRepository.class), stateStore);
        // These are @Value fields (existing style in this service); set directly since no
        // Spring context is in play (backend/CLAUDE.md testing rules: Mockito, no slices).
        ReflectionTestUtils.setField(service, "clientId", "client-id");
        ReflectionTestUtils.setField(service, "redirectUri", "https://api.example.com/callback");
        ReflectionTestUtils.setField(service, "appBaseUrl", "https://app.example.com");
    }

    @Test
    void generateAuthUrl_registersTheEmbeddedStateWithTenMinuteTtl() {
        UUID coupleId = UUID.randomUUID();

        GoogleAuthUrlResponse response = service.generateAuthUrl(coupleId);

        ArgumentCaptor<String> state = ArgumentCaptor.forClass(String.class);
        verify(stateStore).store(state.capture(), eq(coupleId), eq(Duration.ofMinutes(10)));
        // The state Google will echo back must be exactly the one the store can vouch for.
        assertThat(response.authUrl()).contains("state=" + state.getValue());
    }

    @Test
    void handleCallback_rejectsAStateTheStoreDoesNotVouchFor() {
        when(stateStore.consume("forged-or-expired")).thenReturn(Optional.empty());

        String redirect = service.handleCallback("auth-code", "forged-or-expired");

        assertThat(redirect)
                .isEqualTo("https://app.example.com/dashboard/guests?google_error=invalid_state");
        // Rejected before any token exchange or persistence is attempted.
        verifyNoInteractions(tokenRepository);
    }
}
