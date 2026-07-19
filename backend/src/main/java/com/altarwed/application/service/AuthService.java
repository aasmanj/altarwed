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
import com.altarwed.domain.port.LoginBackoffPort;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.infrastructure.observability.LogSanitizer;
import com.altarwed.infrastructure.security.JwtService;
import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

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
    private final LoginBackoffPort loginBackoff;

    public AuthService(
            CoupleRepository coupleRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            AsyncEmailService asyncEmailService,
            VendorAuthService vendorAuthService,
            LoginBackoffPort loginBackoff
    ) {
        this.coupleRepository = coupleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.asyncEmailService = asyncEmailService;
        this.vendorAuthService = vendorAuthService;
        this.loginBackoff = loginBackoff;
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
        // Per-account backoff (issue #249). Keyed on the normalized email so case/whitespace
        // variants of one address share a single failure budget (an attacker cannot mint fresh
        // budgets by re-casing the email), and checked BEFORE any repository or BCrypt work so a
        // cooling-down key costs us nothing. This is the single enforcement point for every
        // credential login: couples, the vendor fallback below, and nonexistent emails all pass
        // through here, so real and unknown accounts accrue identical backoff state.
        String backoffKey = normalizeEmail(request.email());
        if (loginBackoff.isLockedOut(backoffKey)) {
            // Anti-oracle: the SAME generic 401 the handler returns for a wrong password or an
            // unknown email. A distinct 429/"account locked" response would confirm to an
            // attacker both that the backoff engaged and (if only real accounts were tracked)
            // that the account exists. The operational detail lives in this WARN, masked.
            log.warn("login rejected, reason=per-account backoff active, email={}",
                    LogSanitizer.maskEmail(request.email()));
            throw new BadCredentialsException("Invalid email or password");
        }

        // Note: the guard above and the recordFailure below are two separate steps spanning the
        // whole credential check, so the threshold is NOT a hard cap under concurrency: a
        // parallel burst for one email can all pass isLockedOut before any of them latches the
        // cool-down. Acceptable: each burst still ends locked, escalation still applies, and the
        // per-IP RateLimitingFilter bounds single-source concurrency.
        try {
            AuthResponse response = authenticate(request);
            // Success clears the failure history so a user who finally remembered their
            // password is never one slip away from an escalated cool-down.
            loginBackoff.recordSuccess(backoffKey);
            return response;
        } catch (AuthenticationException ex) {
            // Covers BadCredentialsException from both the couple path (AuthenticationManager)
            // and the vendor fallback (unknown email or wrong password), plus DisabledException
            // et al. Recording happens in memory, so the @Transactional rollback triggered by
            // this rethrow cannot undo it (a same-transaction DB counter would silently lose
            // every increment to that rollback).
            loginBackoff.recordFailure(backoffKey);
            throw ex;
        }
    }

    private AuthResponse authenticate(LoginRequest request) {
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

        String accessToken = jwtService.generateAccessToken(couple.email(), ROLE_COUPLE, couple.id());
        String rawRefresh = jwtService.generateRefreshToken(couple.email(), ROLE_COUPLE, couple.id());
        persistRefreshToken(rawRefresh, couple.id(), ROLE_COUPLE);

        log.info("login succeeded, role=COUPLE, coupleId={}, email={}", couple.id(), maskedEmail);
        return AuthResponse.of(accessToken, rawRefresh, couple.id(), couple.email(),
                ROLE_COUPLE, couple.partnerOneName(), couple.partnerTwoName(), couple.weddingDate(), couple.marketingConsent());
    }

    // noRollbackFor is load-bearing: the reuse tripwire deletes the token family
    // and then throws InvalidRefreshTokenException (a RuntimeException) to return
    // the generic 401. Spring's default rule rolls the transaction back on any
    // unchecked exception, which would silently undo the revocation and make the
    // whole control a no-op. Committing on this exception keeps the family delete
    // (and the expired-row cleanup) durable while still failing the request.
    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public AuthResponse refresh(String rawRefreshToken) {
        Claims claims = jwtService.parseRefreshToken(rawRefreshToken);
        String tokenHash = jwtService.hashToken(rawRefreshToken);

        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> {
                    log.warn("token refresh rejected, reason=token not found");
                    return new InvalidRefreshTokenException();
                });

        // Theft tripwire (issue #250): a superseded token is kept as a revoked row
        // after rotation. Seeing it again means two parties hold the same token,
        // the legitimate client already rotated it, so this presenter (or the one
        // now holding the live descendant) stole it. Revoke the whole family so
        // BOTH sessions die and the real user must re-login. The response is the
        // same generic 401 as any invalid token, so an attacker cannot tell
        // detection from ordinary expiry.
        if (stored.revoked()) {
            UUID familyId = stored.familyId();
            if (familyId != null) {
                refreshTokenRepository.deleteAllByFamilyId(familyId);
            } else {
                // Pre-V96 row with no family recorded: fall back to revoking every
                // session of the user, the strictly safer containment.
                refreshTokenRepository.deleteAllByUserId(stored.userId());
            }
            log.warn("token reuse detected, refresh token family revoked, userId={}, familyId={}, email={}",
                    stored.userId(), familyId, LogSanitizer.maskEmail(jwtService.extractEmail(claims)));
            throw new InvalidRefreshTokenException();
        }

        if (stored.isExpired()) {
            log.warn("token refresh rejected, reason=token invalid or expired, userId={}", stored.userId());
            refreshTokenRepository.deleteByTokenHash(tokenHash);
            throw new InvalidRefreshTokenException();
        }

        // rotate: mark old superseded (kept as the reuse tripwire), issue new pair
        // in the same family so descendants stay linked to their chain
        UUID familyId = stored.familyIdOrSelf();
        refreshTokenRepository.save(stored.superseded());

        String email = jwtService.extractEmail(claims);
        String role = jwtService.extractRole(claims);
        var userId = jwtService.extractUserId(claims);

        String newAccessToken = jwtService.generateAccessToken(email, role, userId);
        String newRawRefresh = jwtService.generateRefreshToken(email, role, userId);
        persistRefreshToken(newRawRefresh, userId, role, familyId);
        // Superseded rows are only useful as tripwires while the raw JWT could
        // still be replayed; prune the ones past their JWT expiry so the table
        // does not grow without bound.
        refreshTokenRepository.deleteAllByUserIdAndExpiresAtBefore(userId, LocalDateTime.now());
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

    // Backoff key normalization: trim + lower-case so "Foo@X.com" and " foo@x.com " share one
    // failure budget. Root locale keeps the fold deterministic regardless of server locale
    // (the Turkish-i problem). Login credential matching itself is untouched; this only
    // canonicalizes the tracking key.
    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    // Map the optional wire DTO to the domain value object, normalising blanks to
    // null and truncating over-long values. A missing acquisition block (the common
    // case: organic/direct signups) becomes AcquisitionSource.empty(), never null.
    private AcquisitionSource toAcquisitionSource(AcquisitionInfo info) {
        if (info == null) return AcquisitionSource.empty();
        return AcquisitionSource.of(
                info.utmSource(), info.utmMedium(), info.utmCampaign(),
                info.utmTerm(), info.utmContent(), info.referrer(), info.landingPath());
    }

    // Every fresh login/registration starts a new token family; rotation passes
    // the inherited family id so the whole chain stays revocable as one unit.
    private void persistRefreshToken(String rawToken, java.util.UUID userId, String role) {
        persistRefreshToken(rawToken, userId, role, UUID.randomUUID());
    }

    private void persistRefreshToken(String rawToken, java.util.UUID userId, String role, UUID familyId) {
        long expiryMs = jwtService.getRefreshTokenExpiryMs();
        var refreshToken = new RefreshToken(
                null,
                jwtService.hashToken(rawToken),
                userId,
                role,
                familyId,
                LocalDateTime.now().plusSeconds(expiryMs / 1000),
                false,
                null
        );
        refreshTokenRepository.save(refreshToken);
    }
}
