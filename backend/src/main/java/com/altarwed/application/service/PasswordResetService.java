package com.altarwed.application.service;

import com.altarwed.domain.exception.InvalidPasswordResetTokenException;
import com.altarwed.domain.model.PasswordResetToken;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.PasswordResetTokenRepository;
import com.altarwed.domain.port.VendorRepository;
import com.altarwed.infrastructure.observability.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;


@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int EXPIRY_MINUTES = 15;

    private final PasswordResetTokenRepository tokenRepository;
    private final CoupleRepository coupleRepository;
    private final VendorRepository vendorRepository;
    private final PasswordEncoder passwordEncoder;
    private final AsyncEmailService emailPort;

    public PasswordResetService(
            PasswordResetTokenRepository tokenRepository,
            CoupleRepository coupleRepository,
            VendorRepository vendorRepository,
            PasswordEncoder passwordEncoder,
            AsyncEmailService emailPort
    ) {
        this.tokenRepository = tokenRepository;
        this.coupleRepository = coupleRepository;
        this.vendorRepository = vendorRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailPort = emailPort;
    }

    // Intentionally returns void and never reveals whether the email exists.
    // This prevents account enumeration: an attacker probing emails gets the
    // same 200 response regardless of whether the email is registered.
    @Transactional
    public void requestReset(String email) {
        String maskedEmail = LogSanitizer.maskEmail(email);
        log.info("password reset requested, email={}", maskedEmail);

        boolean isCouple = coupleRepository.existsByEmail(email);
        boolean isVendor = !isCouple && vendorRepository.existsByEmail(email);

        if (!isCouple && !isVendor) {
            log.info("password reset skipped, no account, email={}", maskedEmail);
            return;
        }

        tokenRepository.deleteAllByEmail(email);

        String rawToken = UUID.randomUUID().toString();
        String tokenHash = hash(rawToken);

        var resetToken = new PasswordResetToken(
                null,
                tokenHash,
                email,
                LocalDateTime.now().plusMinutes(EXPIRY_MINUTES),
                false,
                null
        );
        tokenRepository.save(resetToken);

        emailPort.sendPasswordResetEmail(email, rawToken);
        log.info("password reset email queued, email={}", maskedEmail);
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        String tokenHash = hash(rawToken);

        PasswordResetToken token = tokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> {
                    log.warn("password reset rejected, reason=token not found");
                    return new InvalidPasswordResetTokenException();
                });

        if (!token.isValid()) {
            log.warn("password reset rejected, reason=token invalid or expired, email={}",
                     LogSanitizer.maskEmail(token.email()));
            throw new InvalidPasswordResetTokenException();
        }

        String newHash = passwordEncoder.encode(newPassword);

        var couple = coupleRepository.findByEmail(token.email());
        if (couple.isPresent()) {
            coupleRepository.save(couple.get().withPasswordHash(newHash));
            tokenRepository.markUsed(tokenHash);
            log.info("password reset succeeded, coupleId={}, email={}",
                     couple.get().id(), LogSanitizer.maskEmail(token.email()));
            return;
        }

        var vendor = vendorRepository.findByEmail(token.email())
                .orElseThrow(InvalidPasswordResetTokenException::new);
        vendorRepository.save(vendor.withPasswordHash(newHash));
        tokenRepository.markUsed(tokenHash);
        log.info("password reset succeeded, vendorId={}, email={}",
                 vendor.id(), LogSanitizer.maskEmail(token.email()));
    }

    private String hash(String value) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
