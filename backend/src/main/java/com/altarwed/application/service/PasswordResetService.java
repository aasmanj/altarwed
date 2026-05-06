package com.altarwed.application.service;

import com.altarwed.domain.exception.InvalidPasswordResetTokenException;
import com.altarwed.domain.model.PasswordResetToken;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.application.service.AsyncEmailService;
import com.altarwed.domain.port.PasswordResetTokenRepository;
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

    private static final int EXPIRY_MINUTES = 15;

    private final PasswordResetTokenRepository tokenRepository;
    private final CoupleRepository coupleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AsyncEmailService emailPort;

    public PasswordResetService(
            PasswordResetTokenRepository tokenRepository,
            CoupleRepository coupleRepository,
            PasswordEncoder passwordEncoder,
            AsyncEmailService emailPort
    ) {
        this.tokenRepository = tokenRepository;
        this.coupleRepository = coupleRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailPort = emailPort;
    }

    // Intentionally returns void and never reveals whether the email exists.
    // This prevents account enumeration: an attacker probing emails gets the
    // same 200 response regardless of whether the email is registered.
    @Transactional
    public void requestReset(String email) {
        if (!coupleRepository.existsByEmail(email)) {
            return;
        }

        // Invalidate any outstanding tokens for this email before issuing a new one.
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
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        String tokenHash = hash(rawToken);

        PasswordResetToken token = tokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(InvalidPasswordResetTokenException::new);

        if (!token.isValid()) {
            throw new InvalidPasswordResetTokenException();
        }

        var couple = coupleRepository.findByEmail(token.email())
                .orElseThrow(InvalidPasswordResetTokenException::new);

        coupleRepository.save(couple.withPasswordHash(passwordEncoder.encode(newPassword)));

        // Mark token consumed so replay attempts are rejected.
        tokenRepository.markUsed(tokenHash);
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
