package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.GoogleOAuthToken;
import com.altarwed.infrastructure.persistence.entity.GoogleOAuthTokenEntity;
import com.altarwed.infrastructure.persistence.repository.JpaGoogleOAuthTokenRepository;
import com.altarwed.infrastructure.security.TokenEncryptionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Proves the encryption fix for issue #42 at the boundary that matters: what actually reaches the
 * JPA entity (and therefore the DB row) must never be the plaintext access/refresh token, while
 * every caller of the port keeps seeing plaintext via the domain model.
 */
@ExtendWith(MockitoExtension.class)
class GoogleOAuthTokenAdapterTest {

    @Mock private JpaGoogleOAuthTokenRepository jpa;

    private static TokenEncryptionService realEncryptionService() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return new TokenEncryptionService(Base64.getEncoder().encodeToString(key));
    }

    @Test
    void save_neverPersistsPlaintextAccessOrRefreshTokenOnTheEntity() {
        TokenEncryptionService encryption = realEncryptionService();
        GoogleOAuthTokenAdapter adapter = new GoogleOAuthTokenAdapter(jpa, encryption);
        UUID coupleId = UUID.randomUUID();
        GoogleOAuthToken token = new GoogleOAuthToken(
                UUID.randomUUID(), coupleId,
                "ya29.plaintext-access-token", "1//plaintext-refresh-token",
                "Bearer", OffsetDateTime.now().plusHours(1),
                "couple@example.com", "drive.file",
                OffsetDateTime.now(), OffsetDateTime.now());

        ArgumentCaptor<GoogleOAuthTokenEntity> captor = ArgumentCaptor.forClass(GoogleOAuthTokenEntity.class);
        when(jpa.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        adapter.save(token);

        GoogleOAuthTokenEntity persisted = captor.getValue();
        assertThat(persisted.getAccessToken()).isNotEqualTo("ya29.plaintext-access-token").startsWith("gcm:v1:");
        assertThat(persisted.getRefreshToken()).isNotEqualTo("1//plaintext-refresh-token").startsWith("gcm:v1:");
    }

    @Test
    void findByCoupleId_decryptsBackToOriginalPlaintextForCallers() {
        TokenEncryptionService encryption = realEncryptionService();
        GoogleOAuthTokenAdapter adapter = new GoogleOAuthTokenAdapter(jpa, encryption);
        UUID coupleId = UUID.randomUUID();

        GoogleOAuthTokenEntity stored = new GoogleOAuthTokenEntity();
        stored.setId(UUID.randomUUID());
        stored.setCoupleId(coupleId);
        stored.setAccessToken(encryption.encrypt("ya29.plaintext-access-token"));
        stored.setRefreshToken(encryption.encrypt("1//plaintext-refresh-token"));
        stored.setTokenType("Bearer");
        stored.setExpiresAt(OffsetDateTime.now().plusHours(1));
        stored.setCreatedAt(OffsetDateTime.now());
        stored.setUpdatedAt(OffsetDateTime.now());
        when(jpa.findByCoupleId(coupleId)).thenReturn(Optional.of(stored));

        Optional<GoogleOAuthToken> result = adapter.findByCoupleId(coupleId);

        assertThat(result).isPresent();
        assertThat(result.get().accessToken()).isEqualTo("ya29.plaintext-access-token");
        assertThat(result.get().refreshToken()).isEqualTo("1//plaintext-refresh-token");
    }

    @Test
    void findByCoupleId_legacyUnencryptedRow_stillReadsCorrectly() {
        // Rows written before this change are plaintext; TokenEncryptionService must pass them
        // through unchanged rather than throwing, so an in-flight Google Sheets sync does not
        // break the moment this fix deploys.
        TokenEncryptionService encryption = realEncryptionService();
        GoogleOAuthTokenAdapter adapter = new GoogleOAuthTokenAdapter(jpa, encryption);
        UUID coupleId = UUID.randomUUID();

        GoogleOAuthTokenEntity legacy = new GoogleOAuthTokenEntity();
        legacy.setId(UUID.randomUUID());
        legacy.setCoupleId(coupleId);
        legacy.setAccessToken("ya29.legacy-plaintext-access-token");
        legacy.setRefreshToken("1//legacy-plaintext-refresh-token");
        legacy.setTokenType("Bearer");
        legacy.setExpiresAt(OffsetDateTime.now().plusHours(1));
        legacy.setCreatedAt(OffsetDateTime.now());
        legacy.setUpdatedAt(OffsetDateTime.now());
        when(jpa.findByCoupleId(coupleId)).thenReturn(Optional.of(legacy));

        Optional<GoogleOAuthToken> result = adapter.findByCoupleId(coupleId);

        assertThat(result).isPresent();
        assertThat(result.get().accessToken()).isEqualTo("ya29.legacy-plaintext-access-token");
        assertThat(result.get().refreshToken()).isEqualTo("1//legacy-plaintext-refresh-token");
    }

    @Test
    void countLegacyPlaintextTokens_delegatesToJpaRepository() {
        GoogleOAuthTokenAdapter adapter = new GoogleOAuthTokenAdapter(jpa, realEncryptionService());
        when(jpa.countLegacyPlaintextTokens()).thenReturn(3L);

        assertThat(adapter.countLegacyPlaintextTokens()).isEqualTo(3L);
        verify(jpa).countLegacyPlaintextTokens();
    }
}
