package com.altarwed.application.service;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.RegisterVendorRequest;
import com.altarwed.domain.exception.EmailAlreadyExistsException;
import com.altarwed.domain.model.RefreshToken;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.infrastructure.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class VendorAuthService {

    private static final String ROLE_VENDOR = "VENDOR";

    private final VendorRepository vendorRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public VendorAuthService(
            VendorRepository vendorRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.vendorRepository = vendorRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterVendorRequest request) {
        if (vendorRepository.existsByEmail(request.email())) {
            throw new EmailAlreadyExistsException(request.email());
        }

        var vendor = new Vendor(
                null,
                request.businessName(),
                request.category(),
                request.city(),
                request.state(),
                request.email(),
                passwordEncoder.encode(request.password()),
                request.isChristianOwned(),
                request.denominationIds() != null ? request.denominationIds() : List.of(),
                true,
                false,
                null,
                null
        );

        Vendor saved = vendorRepository.save(vendor);

        String accessToken = jwtService.generateAccessToken(saved.email(), ROLE_VENDOR, saved.id());
        String rawRefresh = jwtService.generateRefreshToken(saved.email(), ROLE_VENDOR, saved.id());
        persistRefreshToken(rawRefresh, saved.id(), ROLE_VENDOR);

        return AuthResponse.of(accessToken, rawRefresh, saved.id(), saved.email());
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private void persistRefreshToken(String rawToken, UUID userId, String role) {
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
