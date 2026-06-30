package com.altarwed.application.service;

import com.altarwed.application.dto.AuthResponse;
import com.altarwed.application.dto.LoginRequest;
import com.altarwed.application.dto.RegisterVendorRequest;
import com.altarwed.domain.exception.EmailAlreadyExistsException;
import com.altarwed.domain.model.RefreshToken;
import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.port.RefreshTokenRepository;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.infrastructure.observability.LogSanitizer;
import com.altarwed.infrastructure.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class VendorAuthService {

    private static final Logger log = LoggerFactory.getLogger(VendorAuthService.class);
    private static final String ROLE_VENDOR = "VENDOR";

    private final VendorRepository vendorRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AsyncEmailService asyncEmailService;
    private final VendorPromoService vendorPromoService;
    private final String publicBaseUrl;
    private final long foundingVendorCap;

    public VendorAuthService(
            VendorRepository vendorRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AsyncEmailService asyncEmailService,
            VendorPromoService vendorPromoService,
            @Value("${altarwed.nextjs.base-url:https://www.altarwed.com}") String publicBaseUrl,
            @Value("${altarwed.vendor.founding-cap:25}") long foundingVendorCap
    ) {
        this.vendorRepository = vendorRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.asyncEmailService = asyncEmailService;
        this.vendorPromoService = vendorPromoService;
        this.publicBaseUrl = publicBaseUrl;
        this.foundingVendorCap = foundingVendorCap;
    }

    @Transactional
    public AuthResponse register(RegisterVendorRequest request) {
        String maskedEmail = LogSanitizer.maskEmail(request.email());
        log.info("vendor registration started, email={}, category={}", maskedEmail, request.category());
        if (vendorRepository.existsByEmail(request.email())) {
            log.warn("vendor registration rejected, email already exists, email={}", maskedEmail);
            throw new EmailAlreadyExistsException(request.email());
        }

        // Check before saving so we get an accurate pre-registration count.
        boolean isFoundingVendor = foundingVendorCap > 0 && vendorRepository.countVerified() < foundingVendorCap;

        var vendor = new Vendor(
                null,
                request.businessName(),
                request.category(),
                request.city(),
                request.state(),
                request.email(),
                passwordEncoder.encode(request.password()),
                Boolean.TRUE.equals(request.isChristianOwned()),
                request.denominationIds() != null ? request.denominationIds() : List.of(),
                true,
                isFoundingVendor,  // founding vendors are verified at construction so the subscription
                                   // save below (T1) sees the committed row -- avoids the REQUIRES_NEW
                                   // isolation problem where T2 can't read T1's uncommitted vendor row
                null,   // priceTier
                null,   // bio
                null,   // description
                null,   // websiteUrl
                null,   // phone
                null,   // logoUrl
                null,   // viewCount -- DB column has DEFAULT 0
                null,   // contactEmail -- not set at registration
                null,
                null
        );

        Vendor saved = vendorRepository.save(vendor);

        String accessToken = jwtService.generateAccessToken(saved.email(), ROLE_VENDOR, saved.id());
        String rawRefresh = jwtService.generateRefreshToken(saved.email(), ROLE_VENDOR, saved.id());
        persistRefreshToken(rawRefresh, saved.id(), ROLE_VENDOR);

        log.info("vendor registration succeeded, vendorId={}, isFoundingVendor={}, email={}",
                saved.id(), isFoundingVendor, maskedEmail);

        // Save the founding subscription record in the same transaction as the vendor row.
        // grantFoundingVendorAccess() does NOT call vendorService.verify() here -- the vendor
        // is already isVerified=true from construction, so there is no REQUIRES_NEW round-trip
        // that would open a second connection and fail to see the uncommitted vendor row.
        if (isFoundingVendor) {
            vendorPromoService.grantFoundingVendorAccess(saved.id());
        }

        String listingUrl = publicBaseUrl + "/vendors/" + saved.id();
        asyncEmailService.sendVendorRegistrationAlert(
                saved.businessName(),
                saved.category() != null ? saved.category().name() : "UNKNOWN",
                saved.city(),
                saved.state(),
                saved.email(),
                saved.id().toString(),
                listingUrl,
                isFoundingVendor
        );
        log.info("vendor registration alert queued, vendorId={}", saved.id());

        return AuthResponse.of(accessToken, rawRefresh, saved.id(), saved.email(), ROLE_VENDOR, null, null, null, false);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String maskedEmail = LogSanitizer.maskEmail(request.email());
        log.info("login attempt, role=VENDOR, email={}", maskedEmail);

        Vendor vendor = vendorRepository.findByEmail(request.email())
                .orElseThrow(() -> {
                    log.warn("login failed, email={}, reason=no account found", maskedEmail);
                    return new BadCredentialsException("Invalid email or password");
                });

        if (!passwordEncoder.matches(request.password(), vendor.passwordHash())) {
            log.warn("login failed, role=VENDOR, email={}, reason=BadCredentialsException", maskedEmail);
            throw new BadCredentialsException("Invalid email or password");
        }

        String accessToken = jwtService.generateAccessToken(vendor.email(), ROLE_VENDOR, vendor.id());
        String rawRefresh = jwtService.generateRefreshToken(vendor.email(), ROLE_VENDOR, vendor.id());
        persistRefreshToken(rawRefresh, vendor.id(), ROLE_VENDOR);

        log.info("login succeeded, role=VENDOR, vendorId={}, email={}", vendor.id(), maskedEmail);
        return AuthResponse.of(accessToken, rawRefresh, vendor.id(), vendor.email(), ROLE_VENDOR, null, null, null, false);
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
