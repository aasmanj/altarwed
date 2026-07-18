package com.altarwed.application.service;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.LoginRequest;
import com.altarwed.domain.model.AcquisitionSource;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.LoginBackoffPort;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.infrastructure.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Per-account login backoff enforcement in the login path (issue #249). Mockito, no Spring
 * context. The escalation schedule itself is proven in InMemoryLoginBackoffAdapterTest; here we
 * pin the service wiring: the guard fires before any credential work, failures are charged for
 * BOTH the couple path and the vendor fallback (including nonexistent emails), success clears,
 * the key is normalized, and a locked real account is indistinguishable from a locked unknown
 * email (same exception type and message, zero repository touches for either).
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private CoupleRepository coupleRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private AsyncEmailService asyncEmailService;
    @Mock private VendorAuthService vendorAuthService;
    @Mock private LoginBackoffPort loginBackoff;

    @InjectMocks private AuthService authService;

    private static final String EMAIL = "couple@example.com";
    private static final String PASSWORD = "not-the-password";

    private static LoginRequest request(String email) {
        return new LoginRequest(email, PASSWORD);
    }

    private Couple couple() {
        return new Couple(UUID.randomUUID(), "Jordan", "Eden", EMAIL, "$2a$12$hash",
                LocalDate.of(2027, 6, 12), null, AcquisitionSource.empty(), true, true,
                LocalDateTime.now(), LocalDateTime.now());
    }

    @Test
    void lockedKeyIsRejectedBeforeAnyCredentialWork() {
        when(loginBackoff.isLockedOut(EMAIL)).thenReturn(true);

        assertThatThrownBy(() -> authService.login(request(EMAIL)))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid email or password");

        // The guard must short-circuit: no existence lookup (no timing oracle), no BCrypt, no
        // vendor fallback, and crucially no recordFailure (a rejected-while-locked attempt must
        // not extend the cool-down, or an attacker could pin a victim out indefinitely).
        verifyNoInteractions(coupleRepository, authenticationManager, vendorAuthService);
        verify(loginBackoff, never()).recordFailure(anyString());
    }

    @Test
    void lockedRealAccountAndLockedUnknownEmailAreIndistinguishable() {
        // Both keys report locked; one would resolve to a real couple, the other to nothing.
        when(loginBackoff.isLockedOut("real@example.com")).thenReturn(true);
        when(loginBackoff.isLockedOut("ghost@example.com")).thenReturn(true);

        Throwable real = catchThrowable(() -> authService.login(request("real@example.com")));
        Throwable ghost = catchThrowable(() -> authService.login(request("ghost@example.com")));

        // Identical exception type and message, which GlobalExceptionHandler maps to the one
        // generic 401 body; and neither path touched a repository, so response time cannot
        // betray existence either.
        assertThat(real).isInstanceOf(BadCredentialsException.class);
        assertThat(ghost).isInstanceOf(BadCredentialsException.class);
        assertThat(real.getMessage()).isEqualTo(ghost.getMessage());
        verifyNoInteractions(coupleRepository, vendorAuthService, authenticationManager);
    }

    @Test
    void coupleAuthFailureIsChargedAndRethrown() {
        when(loginBackoff.isLockedOut(EMAIL)).thenReturn(false);
        when(coupleRepository.existsByEmail(EMAIL)).thenReturn(true);
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThatThrownBy(() -> authService.login(request(EMAIL)))
                .isInstanceOf(BadCredentialsException.class);

        verify(loginBackoff).recordFailure(EMAIL);
        verify(loginBackoff, never()).recordSuccess(anyString());
    }

    @Test
    void vendorFallbackFailureIsChargedAndRethrown() {
        // Unknown-to-couples email falls through to the vendor path; a nonexistent email fails
        // there with the same BadCredentialsException. Charging THIS path is what makes locked
        // unknown emails accrue real state, the enumeration-safety prerequisite.
        when(loginBackoff.isLockedOut("ghost@example.com")).thenReturn(false);
        when(coupleRepository.existsByEmail("ghost@example.com")).thenReturn(false);
        when(vendorAuthService.login(any(LoginRequest.class)))
                .thenThrow(new BadCredentialsException("Invalid email or password"));

        assertThatThrownBy(() -> authService.login(request("ghost@example.com")))
                .isInstanceOf(BadCredentialsException.class);

        verify(loginBackoff).recordFailure("ghost@example.com");
        verify(loginBackoff, never()).recordSuccess(anyString());
    }

    @Test
    void successfulCoupleLoginClearsTheKey() {
        Couple couple = couple();
        when(loginBackoff.isLockedOut(EMAIL)).thenReturn(false);
        when(coupleRepository.existsByEmail(EMAIL)).thenReturn(true);
        when(coupleRepository.findByEmail(EMAIL)).thenReturn(Optional.of(couple));
        when(jwtService.generateAccessToken(EMAIL, "COUPLE", couple.id())).thenReturn("access");
        when(jwtService.generateRefreshToken(EMAIL, "COUPLE", couple.id())).thenReturn("refresh");

        AuthResponse response = authService.login(request(EMAIL));

        assertThat(response.accessToken()).isEqualTo("access");
        verify(loginBackoff).recordSuccess(EMAIL);
        verify(loginBackoff, never()).recordFailure(anyString());
    }

    @Test
    void successfulVendorFallbackLoginClearsTheKey() {
        String vendorEmail = "vendor@example.com";
        when(loginBackoff.isLockedOut(vendorEmail)).thenReturn(false);
        when(coupleRepository.existsByEmail(vendorEmail)).thenReturn(false);
        when(vendorAuthService.login(any(LoginRequest.class))).thenReturn(
                AuthResponse.of("access", "refresh", UUID.randomUUID(), vendorEmail,
                        "VENDOR", null, null, null, false));

        authService.login(request(vendorEmail));

        verify(loginBackoff).recordSuccess(vendorEmail);
        verify(loginBackoff, never()).recordFailure(anyString());
    }

    @Test
    void backoffKeyIsNormalizedAcrossCaseAndWhitespaceVariants() {
        // " MiXeD@Example.COM " must charge the same key as "mixed@example.com", so an attacker
        // cannot mint a fresh failure budget per casing variant.
        String rawVariant = "  MiXeD@Example.COM ";
        when(loginBackoff.isLockedOut("mixed@example.com")).thenReturn(false);
        when(coupleRepository.existsByEmail(rawVariant)).thenReturn(false);
        when(vendorAuthService.login(any(LoginRequest.class)))
                .thenThrow(new BadCredentialsException("Invalid email or password"));

        assertThatThrownBy(() -> authService.login(request(rawVariant)))
                .isInstanceOf(BadCredentialsException.class);

        verify(loginBackoff).isLockedOut("mixed@example.com");
        verify(loginBackoff).recordFailure("mixed@example.com");
    }
}
