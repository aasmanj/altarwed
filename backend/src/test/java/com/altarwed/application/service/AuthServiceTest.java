package com.altarwed.application.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.altarwed.application.dto.AuthResponse;
import com.altarwed.domain.exception.InvalidRefreshTokenException;
import com.altarwed.domain.model.RefreshToken;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.infrastructure.security.JwtService;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the refresh-token rotation path, including the reuse-detection
 * tripwire from issue #250: replaying an already-rotated (superseded) token must
 * revoke the entire token family while returning the exact same generic 401 as
 * any other invalid token, so an attacker cannot distinguish detection from
 * ordinary expiry.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String RAW_TOKEN = "raw-refresh-token";
    private static final String TOKEN_HASH = "hash-old";
    private static final String NEW_RAW_TOKEN = "new-raw-refresh-token";
    private static final String NEW_TOKEN_HASH = "hash-new";
    private static final String EMAIL = "couple@example.com";
    private static final String ROLE = "COUPLE";

    @Mock private CoupleRepository coupleRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private AsyncEmailService asyncEmailService;
    @Mock private VendorAuthService vendorAuthService;

    private AuthService authService;
    private final UUID userId = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();
    private final Claims claims = mock(Claims.class);

    private ListAppender<ILoggingEvent> logAppender;

    @BeforeEach
    void setUp() {
        authService = new AuthService(coupleRepository, refreshTokenRepository, passwordEncoder,
                jwtService, authenticationManager, asyncEmailService, vendorAuthService);

        // capture the security log so the WARN tripwire can be asserted
        logAppender = new ListAppender<>();
        logAppender.start();
        ((Logger) LoggerFactory.getLogger(AuthService.class)).addAppender(logAppender);

        lenient().when(jwtService.parseRefreshToken(RAW_TOKEN)).thenReturn(claims);
        lenient().when(jwtService.hashToken(RAW_TOKEN)).thenReturn(TOKEN_HASH);
        lenient().when(jwtService.extractEmail(claims)).thenReturn(EMAIL);
        lenient().when(jwtService.extractRole(claims)).thenReturn(ROLE);
        lenient().when(jwtService.extractUserId(claims)).thenReturn(userId);
        lenient().when(jwtService.generateAccessToken(EMAIL, ROLE, userId)).thenReturn("new-access-token");
        lenient().when(jwtService.generateRefreshToken(EMAIL, ROLE, userId)).thenReturn(NEW_RAW_TOKEN);
        lenient().when(jwtService.hashToken(NEW_RAW_TOKEN)).thenReturn(NEW_TOKEN_HASH);
        lenient().when(jwtService.getRefreshTokenExpiryMs()).thenReturn(604_800_000L);
        lenient().when(coupleRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
    }

    @AfterEach
    void tearDown() {
        ((Logger) LoggerFactory.getLogger(AuthService.class)).detachAppender(logAppender);
    }

    private RefreshToken storedToken(UUID family, boolean revoked, LocalDateTime expiresAt) {
        return new RefreshToken(UUID.randomUUID(), TOKEN_HASH, userId, ROLE, family, expiresAt, revoked, LocalDateTime.now().minusHours(1));
    }

    // -------------------------------------------------------------------------
    // Normal rotation
    // -------------------------------------------------------------------------

    @Test
    void refresh_validToken_rotatesWithinSameFamily() {
        RefreshToken stored = storedToken(familyId, false, LocalDateTime.now().plusDays(7));
        when(refreshTokenRepository.findByTokenHash(TOKEN_HASH)).thenReturn(Optional.of(stored));

        AuthResponse response = authService.refresh(RAW_TOKEN);

        // old row kept as a revoked tripwire, new token issued in the SAME family
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository, times(2)).save(saved.capture());
        RefreshToken superseded = saved.getAllValues().get(0);
        RefreshToken issued = saved.getAllValues().get(1);

        assertThat(superseded.id()).isEqualTo(stored.id());
        assertThat(superseded.tokenHash()).isEqualTo(TOKEN_HASH);
        assertThat(superseded.revoked()).isTrue();
        assertThat(superseded.familyId()).isEqualTo(familyId);

        assertThat(issued.tokenHash()).isEqualTo(NEW_TOKEN_HASH);
        assertThat(issued.revoked()).isFalse();
        assertThat(issued.familyId()).isEqualTo(familyId);
        assertThat(issued.userId()).isEqualTo(userId);

        // no revocation of anything on the happy path
        verify(refreshTokenRepository, never()).deleteAllByFamilyId(any());
        verify(refreshTokenRepository, never()).deleteAllByUserId(any());
        verify(refreshTokenRepository, never()).deleteByTokenHash(anyString());
        // expired-row pruning is scoped to this user only
        verify(refreshTokenRepository).deleteAllByUserIdAndExpiresAtBefore(eq(userId), any(LocalDateTime.class));

        // response contract unchanged
        assertThat(response.accessToken()).isEqualTo("new-access-token");
        assertThat(response.refreshToken()).isEqualTo(NEW_RAW_TOKEN);
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.userId()).isEqualTo(userId);
        assertThat(response.email()).isEqualTo(EMAIL);
        assertThat(response.role()).isEqualTo(ROLE);
    }

    @Test
    void refresh_legacyTokenWithoutFamily_startsFamilyFromItsOwnId() {
        RefreshToken legacy = storedToken(null, false, LocalDateTime.now().plusDays(7));
        when(refreshTokenRepository.findByTokenHash(TOKEN_HASH)).thenReturn(Optional.of(legacy));

        authService.refresh(RAW_TOKEN);

        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository, times(2)).save(saved.capture());
        // the pre-V96 row becomes the root of its own family; the descendant inherits it
        assertThat(saved.getAllValues().get(0).familyId()).isEqualTo(legacy.id());
        assertThat(saved.getAllValues().get(1).familyId()).isEqualTo(legacy.id());
    }

    // -------------------------------------------------------------------------
    // Reuse detection (theft tripwire)
    // -------------------------------------------------------------------------

    @Test
    void refresh_supersededTokenReplay_revokesEntireFamily() {
        RefreshToken superseded = storedToken(familyId, true, LocalDateTime.now().plusDays(6));
        when(refreshTokenRepository.findByTokenHash(TOKEN_HASH)).thenReturn(Optional.of(superseded));

        assertThatThrownBy(() -> authService.refresh(RAW_TOKEN))
                .isInstanceOf(InvalidRefreshTokenException.class);

        // the whole family dies, including the victim's current live descendant
        verify(refreshTokenRepository).deleteAllByFamilyId(familyId);
        // and ONLY that family: no user-wide nuke, no single-row delete, no new tokens
        verify(refreshTokenRepository, never()).deleteAllByUserId(any());
        verify(refreshTokenRepository, never()).deleteByTokenHash(anyString());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void refresh_supersededTokenReplay_logsWarnWithoutTokenValue() {
        RefreshToken superseded = storedToken(familyId, true, LocalDateTime.now().plusDays(6));
        when(refreshTokenRepository.findByTokenHash(TOKEN_HASH)).thenReturn(Optional.of(superseded));

        catchThrowable(() -> authService.refresh(RAW_TOKEN));

        List<ILoggingEvent> warns = logAppender.list.stream()
                .filter(e -> e.getLevel() == Level.WARN)
                .toList();
        assertThat(warns).hasSize(1);
        String message = warns.get(0).getFormattedMessage();
        assertThat(message).contains("token reuse detected");
        assertThat(message).contains(userId.toString());
        assertThat(message).contains(familyId.toString());
        // masked email only, never the raw address, never any token material
        assertThat(message).contains("c***@example.com");
        assertThat(message).doesNotContain(EMAIL);
        assertThat(message).doesNotContain(RAW_TOKEN);
        assertThat(message).doesNotContain(TOKEN_HASH);
    }

    @Test
    void refresh_legacyRevokedTokenWithoutFamily_revokesAllUserSessions() {
        RefreshToken legacyRevoked = storedToken(null, true, LocalDateTime.now().plusDays(6));
        when(refreshTokenRepository.findByTokenHash(TOKEN_HASH)).thenReturn(Optional.of(legacyRevoked));

        assertThatThrownBy(() -> authService.refresh(RAW_TOKEN))
                .isInstanceOf(InvalidRefreshTokenException.class);

        // no family recorded on a pre-V96 row: fall back to the safer user-wide revocation
        verify(refreshTokenRepository).deleteAllByUserId(userId);
        verify(refreshTokenRepository, never()).deleteAllByFamilyId(any());
        verify(refreshTokenRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // Non-reuse failure paths keep their existing behavior
    // -------------------------------------------------------------------------

    @Test
    void refresh_expiredToken_deletesOnlyThatTokenNotTheFamily() {
        RefreshToken expired = storedToken(familyId, false, LocalDateTime.now().minusMinutes(5));
        when(refreshTokenRepository.findByTokenHash(TOKEN_HASH)).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> authService.refresh(RAW_TOKEN))
                .isInstanceOf(InvalidRefreshTokenException.class);

        // plain staleness is not evidence of theft: same behavior as before #250
        verify(refreshTokenRepository).deleteByTokenHash(TOKEN_HASH);
        verify(refreshTokenRepository, never()).deleteAllByFamilyId(any());
        verify(refreshTokenRepository, never()).deleteAllByUserId(any());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void refresh_unknownToken_throwsGeneric401WithoutSideEffects() {
        when(refreshTokenRepository.findByTokenHash(TOKEN_HASH)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.refresh(RAW_TOKEN))
                .isInstanceOf(InvalidRefreshTokenException.class);

        verify(refreshTokenRepository, never()).deleteAllByFamilyId(any());
        verify(refreshTokenRepository, never()).deleteAllByUserId(any());
        verify(refreshTokenRepository, never()).deleteByTokenHash(anyString());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void refresh_reuseDetectionAndUnknownToken_areIndistinguishableToTheCaller() {
        // the tripwire must not become an oracle: the exception (and therefore the
        // 401 ProblemDetail built from its message) is identical in both cases
        RefreshToken superseded = storedToken(familyId, true, LocalDateTime.now().plusDays(6));
        when(refreshTokenRepository.findByTokenHash(TOKEN_HASH))
                .thenReturn(Optional.of(superseded))
                .thenReturn(Optional.empty());

        Throwable onReuse = catchThrowable(() -> authService.refresh(RAW_TOKEN));
        Throwable onUnknown = catchThrowable(() -> authService.refresh(RAW_TOKEN));

        assertThat(onReuse).isInstanceOf(InvalidRefreshTokenException.class);
        assertThat(onUnknown).isInstanceOf(InvalidRefreshTokenException.class);
        assertThat(onReuse.getMessage()).isEqualTo(onUnknown.getMessage());
    }

    @Test
    void refresh_transactionMustNotRollBackTheRevocationOnThe401() throws NoSuchMethodException {
        // The reuse path deletes the token family and THEN throws a RuntimeException
        // to produce the generic 401. Spring's default @Transactional rule rolls back
        // on unchecked exceptions, which would silently undo the revocation and turn
        // the tripwire into a no-op. Mockito cannot observe commit semantics and this
        // codebase avoids Spring test slices (SB4), so pin the annotation contract:
        // InvalidRefreshTokenException must be listed in noRollbackFor.
        var tx = AuthService.class
                .getMethod("refresh", String.class)
                .getAnnotation(org.springframework.transaction.annotation.Transactional.class);
        assertThat(tx).as("@Transactional on AuthService.refresh").isNotNull();
        assertThat(tx.noRollbackFor()).contains(InvalidRefreshTokenException.class);
    }
}
