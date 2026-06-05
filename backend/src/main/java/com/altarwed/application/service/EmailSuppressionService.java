package com.altarwed.application.service;

import com.altarwed.domain.port.EmailSuppressionPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

@Service
public class EmailSuppressionService {

    private static final Logger log = LoggerFactory.getLogger(EmailSuppressionService.class);

    private final EmailSuppressionPort suppressionPort;
    private final String secret;

    public EmailSuppressionService(
            EmailSuppressionPort suppressionPort,
            @Value("${altarwed.unsubscribe.secret}") String secret
    ) {
        this.suppressionPort = suppressionPort;
        this.secret = secret;
    }

    /**
     * SHA-256 hex of lowercase-trimmed email. Use this hash as the suppression key
     * and in unsubscribe URLs so the email address never appears in plaintext.
     */
    public static String emailHash(String email) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(email.toLowerCase().trim().getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    /**
     * HMAC-SHA256 of the emailHash, base64url-encoded without padding.
     * Included in unsubscribe URLs to prevent cross-user suppression.
     */
    public String generateToken(String emailHash) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(emailHash.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("HMAC-SHA256 not available", ex);
        }
    }

    /**
     * Constant-time verification of an unsubscribe token. Returns false for any
     * invalid or malformed input so the caller can return a generic response.
     */
    public boolean verifyToken(String emailHash, String token) {
        if (emailHash == null || token == null) return false;
        try {
            String expected = generateToken(emailHash);
            return MessageDigest.isEqual(
                    Base64.getUrlDecoder().decode(expected),
                    Base64.getUrlDecoder().decode(token));
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    @Transactional
    public void suppress(String emailHash, String source) {
        suppressionPort.suppress(emailHash, source);
    }

    public boolean isSuppressed(String emailHash) {
        return suppressionPort.isSuppressed(emailHash);
    }
}
