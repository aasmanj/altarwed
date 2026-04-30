package com.altarwed.application.service;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.LoginRequest;
import com.altarwed.application.dto.RegisterCoupleRequest;
import com.altarwed.domain.exception.EmailAlreadyExistsException;
import com.altarwed.domain.model.Couple;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.infrastructure.security.JwtService;
import io.jsonwebtoken.Claims;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String ROLE_COUPLE = "COUPLE";

    private final CoupleRepository coupleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthService(
            CoupleRepository coupleRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager
    ) {
        this.coupleRepository = coupleRepository;
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
        String refreshToken = jwtService.generateRefreshToken(saved.email(), ROLE_COUPLE, saved.id());

        return AuthResponse.of(accessToken, refreshToken, saved.id(), saved.email());
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        Couple couple = coupleRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalStateException("Couple not found after authentication"));

        String accessToken = jwtService.generateAccessToken(couple.email(), ROLE_COUPLE, couple.id());
        String refreshToken = jwtService.generateRefreshToken(couple.email(), ROLE_COUPLE, couple.id());

        return AuthResponse.of(accessToken, refreshToken, couple.id(), couple.email());
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(String refreshToken) {
        Claims claims = jwtService.parseRefreshToken(refreshToken);
        String email = jwtService.extractEmail(claims);
        String role = jwtService.extractRole(claims);
        var coupleId = jwtService.extractCoupleId(claims);

        String newAccessToken = jwtService.generateAccessToken(email, role, coupleId);
        String newRefreshToken = jwtService.generateRefreshToken(email, role, coupleId);

        return AuthResponse.of(newAccessToken, newRefreshToken, coupleId, email);
    }
}
