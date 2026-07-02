package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.GoogleOAuthTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface JpaGoogleOAuthTokenRepository extends JpaRepository<GoogleOAuthTokenEntity, UUID> {
    Optional<GoogleOAuthTokenEntity> findByCoupleId(UUID coupleId);
    void deleteByCoupleId(UUID coupleId);

    // Visibility for the encryption self-heal (issue #42): a row written before
    // TokenEncryptionService existed, or never re-saved since, still carries the plaintext
    // token. Native LIKE keeps this a cheap index-free prefix scan on a tiny table instead of
    // pulling every row into Java to check.
    @Query(value = "SELECT COUNT(*) FROM google_oauth_tokens WHERE access_token NOT LIKE 'gcm:v1:%' OR refresh_token NOT LIKE 'gcm:v1:%'", nativeQuery = true)
    long countLegacyPlaintextTokens();
}
