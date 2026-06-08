package com.altarwed.application.service;

import com.altarwed.application.dto.AcquisitionInfo;
import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.LoginRequest;
import com.altarwed.application.dto.RegisterCoupleRequest;
import com.altarwed.domain.model.AcquisitionSource;
import com.altarwed.domain.exception.EmailAlreadyExistsException;
import com.altarwed.domain.exception.InvalidRefreshTokenException;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.RefreshToken;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.infrastructure.observability.LogSanitizer;
import com.altarwed.infrastructure.security.JwtService;
import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String ROLE_COUPLE = "COUPLE";

    private final CoupleRepository coupleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final AsyncEmailService asyncEmailService;
    private final VendorAuthService vendorAuthService;

    public AuthService(
            CoupleRepository coupleRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            AsyncEmailService asyncEmailService,
            VendorAuthService vendorAuthService
    ) {
        this.coupleRepository = coupleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.asyncEmailService = asyncEmailService;
        this.vendorAuthService = vendorAuthService;
    }

    @Transactional
    public AuthResponse register(RegisterCoupleRequest request) {
        String maskedEmail = LogSanitizer.maskEmail(request.email());
        log.info("couple registration started, email={}", maskedEmail);
        if (coupleRepository.existsByEmail(request.email())) {
            log.warn("couple registration rejected, email already exists, email={}", maskedEmail);
            throw new EmailAlreadyExistsException(request.email());
        }

        AcquisitionSource acquisition = toAcquisitionSource(request.acquisition());

        var couple = new Couple(
                null,
                request.partnerOneName(),
                request.partnerTwoName(),
                request.email(),
                passwordEncoder.encode(request.password()),
                request.weddingDate(),
                request.denominationId(),
                acquisition,
                Boolean.TRUE.equals(request.marketingConsent()),
                true,
                null,
                null
        );

        Couple saved = coupleRepository.save(couple);

        String accessToken = jwtService.generateAccessToken(saved.email(), ROLE_COUPLE, saved.id());
        String rawRefresh = jwtService.generateRefreshToken(saved.email(), ROLE_COUPLE, saved.id());
        persistRefreshToken(rawRefresh, saved.id(), ROLE_COUPLE);

        // Attribution at INFO so the first paid-campaign signups are visible in App
        // Insights immediately, without waiting for the daily /admin/metrics roll-up.
        // utm_* values are campaign labels we authored, not PII.
        log.info("couple registration succeeded, coupleId={}, email={}, utmSource={}, utmCampaign={}",
                saved.id(), maskedEmail, acquisition.utmSource(), acquisition.utmCampaign());

        // Fire-and-forget welcome email on its own thread. A delivery failure must
        // never fail registration, so this runs async and is not part of this tx.
        asyncEmailService.sendWelcomeEmail(saved.email(), saved.partnerOneName(), saved.partnerTwoName());
        log.info("welcome email queued, coupleId={}", saved.id());

        return AuthResponse.of(accessToken, rawRefresh, saved.id(), saved.email(),
                ROLE_COUPLE, saved.partnerOneName(), saved.partnerTwoName(), saved.weddingDate(), saved.marketingConsent());
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        // Delegate to vendor login when the email isn't a couple account.
        // AuthenticationManager is wired to the couples UserDetailsService;
        // using it for vendor credentials would always fail.
        if (!coupleRepository.existsByEmail(request.email())) {
            return vendorAuthService.login(request);
        }

        String maskedEmail = LogSanitizer.maskEmail(request.email());
        log.info("login attempt, role=COUPLE, email={}", maskedEmail);
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password())
            );
        } catch (AuthenticationException ex) {
            log.warn("login failed, role=COUPLE, email={}, reason={}", maskedEmail, ex.getClass().getSimpleName());
            throw ex;
        }

        Couple couple = coupleRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalStateException("Couple not found after authentication"));

        // revoke all existing refresh tokens for this user on new login
        refreshTokenRepository.deleteAllByUserId(couple.id());

        String accessToken = jwtService.generateAccessToken(couple.email(), ROLE_COUPLE, couple.id());
        String rawRefresh = jwtService.generateRefreshToken(couple.email(), ROLE_COUPLE, couple.id());
        persistRefreshToken(rawRefresh, couple.id(), ROLE_COUPLE);

        log.info("login succeeded, role=COUPLE, coupleId={}, email={}", couple.id(), maskedEmail);
        return AuthResponse.of(accessToken, rawRefresh, couple.id(), couple.email(),
                ROLE_COUPLE, couple.partnerOneName(), couple.partnerTwoName(), couple.weddingDate(), couple.marketingConsent());
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        Claims claims = jwtService.parseRefreshToken(rawRefreshToken);
        String tokenHash = jwtService.hashToken(rawRefreshToken);

        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> {
                    log.warn("token refresh rejected, reason=token not found");
                    return new InvalidRefreshTokenException();
                });

        if (!stored.isValid()) {
            log.warn("token refresh rejected, reason=token invalid or expired, userId={}", stored.userId());
            refreshTokenRepository.deleteByTokenHash(tokenHash);
            throw new InvalidRefreshTokenException();
        }

        // rotate: delete old, issue new pair
        refreshTokenRepository.deleteByTokenHash(tokenHash);

        String email = jwtService.extractEmail(claims);
        String role = jwtService.extractRole(claims);
        var userId = jwtService.extractUserId(claims);

        String newAccessToken = jwtService.generateAccessToken(email, role, userId);
        String newRawRefresh = jwtService.generateRefreshToken(email, role, userId);
        persistRefreshToken(newRawRefresh, userId, role);
        log.info("token refresh succeeded, userId={}, role={}", userId, role);

        // Load couple to return partner names and consent flag, needed so the frontend can display them after a token refresh
        Couple couple = coupleRepository.findByEmail(email).orElse(null);
        String partnerOneName = couple != null ? couple.partnerOneName() : null;
        String partnerTwoName = couple != null ? couple.partnerTwoName() : null;
        var weddingDate = couple != null ? couple.weddingDate() : null;
        boolean marketingConsent = couple != null && couple.marketingConsent();

        return AuthResponse.of(newAccessToken, newRawRefresh, userId, email, role, partnerOneName, partnerTwoName, weddingDate, marketingConsent);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        String tokenHash = jwtService.hashToken(rawRefreshToken);
        refreshTokenRepository.deleteByTokenHash(tokenHash);
        log.info("logout completed");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    // Map the optional wire DTO to the domain value object, normalising blanks to
    // null and truncating over-long values. A missing acquisition block (the common
    // case: organic/direct signups) becomes AcquisitionSource.empty(), never null.
    private AcquisitionSource toAcquisitionSource(AcquisitionInfo info) {
        if (info == null) return AcquisitionSource.empty();
        return AcquisitionSource.of(
                info.utmSource(), info.utmMedium(), info.utmCampaign(),
                info.utmTerm(), info.utmContent(), info.referrer(), info.landingPath());
    }

    private void persistRefreshToken(String rawToken, java.util.UUID userId, String role) {
        long expiryMs = jwtService.getRefreshTokenExpiryMs();
        var refreshToken = new RefreshToken(
                null,
                jwtService.hashToken(rawToken),
                userId,
                role,
                LocalDateTime.now().plusSeconds(expiryMs / 1000),
                false,
                null
        );
        refreshTokenRepository.save(refreshToken);
    }
}
