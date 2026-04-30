package com.altarwed.application.service;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.LoginRequest;
import com.altarwed.application.dto.RegisterCoupleRequest;
import com.altarwed.domain.exception.EmailAlreadyExistsException;
import com.altarwed.domain.exception.InvalidRefreshTokenException;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.model.RefreshToken;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.infrastructure.security.JwtService;
import io.jsonwebtoken.Claims;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuthService {

    private static final String ROLE_COUPLE = "COUPLE";

    private final CoupleRepository coupleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthService(
            CoupleRepository coupleRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager
    ) {
        this.coupleRepository = coupleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }

    @Transactional
    public AuthResponse register(RegisterCoupleRequest request) {
        if (coupleRepository.existsByEmail(request.email())) {
            throw new EmailAlreadyExistsException(request.email());
        }

        var couple = new Couple(
                null,
                request.partnerOneName(),
                request.partnerTwoName(),
                request.email(),
                passwordEncoder.encode(request.password()),
                request.weddingDate(),
                request.denominationId(),
                true,
                null,
                null
        );

        Couple saved = coupleRepository.save(couple);

        String accessToken = jwtService.generateAccessToken(saved.email(), ROLE_COUPLE, saved.id());
        String rawRefresh = jwtService.generateRefreshToken(saved.email(), ROLE_COUPLE, saved.id());
        persistRefreshToken(rawRefresh, saved.id(), ROLE_COUPLE);

        return AuthResponse.of(accessToken, rawRefresh, saved.id(), saved.email());
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        Couple couple = coupleRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalStateException("Couple not found after authentication"));

        // revoke all existing refresh tokens for this user on new login
        refreshTokenRepository.deleteAllByUserId(couple.id());

        String accessToken = jwtService.generateAccessToken(couple.email(), ROLE_COUPLE, couple.id());
        String rawRefresh = jwtService.generateRefreshToken(couple.email(), ROLE_COUPLE, couple.id());
        persistRefreshToken(rawRefresh, couple.id(), ROLE_COUPLE);

        return AuthResponse.of(accessToken, rawRefresh, couple.id(), couple.email());
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        Claims claims = jwtService.parseRefreshToken(rawRefreshToken);
        String tokenHash = jwtService.hashToken(rawRefreshToken);

        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(InvalidRefreshTokenException::new);

        if (!stored.isValid()) {
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

        return AuthResponse.of(newAccessToken, newRawRefresh, userId, email);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        String tokenHash = jwtService.hashToken(rawRefreshToken);
        refreshTokenRepository.deleteByTokenHash(tokenHash);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

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
