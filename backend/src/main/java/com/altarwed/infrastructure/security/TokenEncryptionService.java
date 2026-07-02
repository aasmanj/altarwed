package com.altarwed.infrastructure.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM envelope encryption for long-lived third-party credentials stored at rest
 * (currently Google OAuth access/refresh tokens, see {@code GoogleOAuthTokenAdapter}). Key comes
 * from Key Vault via {@code GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY} (base64, 32 bytes / AES-256), never
 * hardcoded.
 *
 * <p>Ciphertext is self-describing: {@code "gcm:v1:" + base64(iv) + ":" + base64(ciphertext+tag)}.
 * {@link #decrypt(String)} treats any value WITHOUT that prefix as legacy plaintext written before
 * this change and returns it unchanged; {@link #isEncrypted(String)} lets the caller (see
 * {@code GoogleOAuthTokenAdapter}) detect and log that case with the row's coupleId, which this
 * class cannot see. {@link #encrypt(String)} always produces the new format, so every row
 * self-heals to encrypted the next time it is saved (token refresh, reconnect) -- no bulk data
 * migration/backfill needed, and no window where a half-finished migration could corrupt a live
 * Google Sheets connection. {@code GoogleOAuthTokenAdapter.countLegacyPlaintextTokens()} tracks
 * how many rows have not yet converged, since an inactive connection may never re-save.
 */
@Component
public class TokenEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(TokenEncryptionService.class);

    private static final String PREFIX = "gcm:v1:";
    private static final String ALGO = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom secureRandom = new SecureRandom();

    public TokenEncryptionService(@Value("${altarwed.google.token-encryption-key:}") String base64Key) {
        SecretKeySpec parsed = null;
        if (base64Key == null || base64Key.isBlank()) {
            log.warn("google oauth token encryption key not configured, token encrypt/decrypt will fail closed");
        } else {
            try {
                byte[] raw = Base64.getDecoder().decode(base64Key);
                if (raw.length != 32) {
                    log.warn("google oauth token encryption key is not 32 bytes after base64 decode, length={}", raw.length);
                } else {
                    parsed = new SecretKeySpec(raw, "AES");
                }
            } catch (IllegalArgumentException ex) {
                log.warn("google oauth token encryption key is not valid base64");
            }
        }
        this.key = parsed;
    }

    /** Encrypts plaintext into the self-describing "gcm:v1:" format. Fails closed (throws) if unconfigured. */
    public String encrypt(String plaintext) {
        if (plaintext == null) return null;
        requireKey();
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(ALGO);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(ciphertext);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("token encryption failed", ex);
        }
    }

    /** True if {@code stored} is already in the "gcm:v1:" envelope; false for legacy plaintext (or null). */
    public boolean isEncrypted(String stored) {
        return stored != null && stored.startsWith(PREFIX);
    }

    /** Decrypts a "gcm:v1:" value; passes plaintext through unchanged if it predates encryption. */
    public String decrypt(String stored) {
        if (stored == null || !isEncrypted(stored)) return stored;
        requireKey();
        String[] parts = stored.substring(PREFIX.length()).split(":", 2);
        if (parts.length != 2) {
            throw new IllegalStateException("malformed encrypted token value");
        }
        try {
            byte[] iv = Base64.getDecoder().decode(parts[0]);
            byte[] ciphertext = Base64.getDecoder().decode(parts[1]);
            Cipher cipher = Cipher.getInstance(ALGO);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] plaintext = cipher.doFinal(ciphertext);
            return new String(plaintext, java.nio.charset.StandardCharsets.UTF_8);
        } catch (AEADBadTagException ex) {
            throw new IllegalStateException("token decryption failed integrity check (wrong key or tampered value)", ex);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("token decryption failed", ex);
        }
    }

    private void requireKey() {
        if (key == null) {
            throw new IllegalStateException("GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY is not configured");
        }
    }
}
