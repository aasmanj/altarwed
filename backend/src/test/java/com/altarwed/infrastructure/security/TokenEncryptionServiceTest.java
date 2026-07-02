package com.altarwed.infrastructure.security;

import org.junit.jupiter.api.Test;

import java.security.SecureRandom;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Google OAuth access/refresh tokens are long-lived, reversible credentials to a couple's guest
 * list sheet (issue #42); a DB dump must not yield them in plaintext, but a real key must still
 * round-trip correctly and an unconfigured/wrong key must fail closed rather than leak plaintext.
 */
class TokenEncryptionServiceTest {

    private static String randomBase64Key() {
        byte[] raw = new byte[32];
        new SecureRandom().nextBytes(raw);
        return Base64.getEncoder().encodeToString(raw);
    }

    @Test
    void encryptThenDecrypt_roundTripsToOriginalPlaintext() {
        var service = new TokenEncryptionService(randomBase64Key());
        String token = "ya29.a0AfH6SMB_example_access_token";

        String encrypted = service.encrypt(token);

        assertThat(encrypted).isNotEqualTo(token).startsWith("gcm:v1:");
        assertThat(service.decrypt(encrypted)).isEqualTo(token);
    }

    @Test
    void encrypt_sameInputTwice_producesDifferentCiphertext() {
        // Random IV per call: identical plaintext must not produce identical ciphertext,
        // otherwise an attacker with DB read access could correlate rows.
        var service = new TokenEncryptionService(randomBase64Key());
        String token = "1//refresh-token-example";

        assertThat(service.encrypt(token)).isNotEqualTo(service.encrypt(token));
    }

    @Test
    void decrypt_legacyPlaintextValue_passesThroughUnchanged() {
        var service = new TokenEncryptionService(randomBase64Key());

        assertThat(service.decrypt("ya29.legacy-unencrypted-token")).isEqualTo("ya29.legacy-unencrypted-token");
    }

    @Test
    void encrypt_withoutConfiguredKey_failsClosed() {
        var service = new TokenEncryptionService("");

        assertThatThrownBy(() -> service.encrypt("secret-token"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void decrypt_encryptedValueWithWrongKey_failsClosedInsteadOfReturningGarbage() {
        var writer = new TokenEncryptionService(randomBase64Key());
        var reader = new TokenEncryptionService(randomBase64Key());
        String encrypted = writer.encrypt("secret-token");

        assertThatThrownBy(() -> reader.decrypt(encrypted))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void nullValues_passThroughAsNull() {
        var service = new TokenEncryptionService(randomBase64Key());

        assertThat(service.encrypt(null)).isNull();
        assertThat(service.decrypt(null)).isNull();
    }

    @Test
    void isEncrypted_distinguishesEncryptedFromLegacyPlaintextAndNull() {
        var service = new TokenEncryptionService(randomBase64Key());

        assertThat(service.isEncrypted(service.encrypt("token"))).isTrue();
        assertThat(service.isEncrypted("ya29.legacy-plaintext")).isFalse();
        assertThat(service.isEncrypted(null)).isFalse();
    }
}
