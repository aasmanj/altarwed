package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.GoogleOAuthToken;
import com.altarwed.domain.port.GoogleOAuthTokenRepository;
import com.altarwed.infrastructure.persistence.entity.GoogleOAuthTokenEntity;
import com.altarwed.infrastructure.persistence.repository.JpaGoogleOAuthTokenRepository;
import com.altarwed.infrastructure.security.TokenEncryptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * Encrypts access/refresh tokens at the persistence boundary (AES-256-GCM via
 * {@link TokenEncryptionService}) so the domain model and every caller keep working with
 * plaintext; only the JPA entity ever holds ciphertext. Rows written before this change are
 * plaintext; they self-heal to encrypted the next time they are saved (token refresh, reconnect).
 * {@link #countLegacyPlaintextTokens()} lets the poller report how many rows have not yet
 * converged (issue #42 follow-up), since a couple who connected but never syncs would otherwise
 * never trigger a re-save.
 */
@Component
public class GoogleOAuthTokenAdapter implements GoogleOAuthTokenRepository {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthTokenAdapter.class);

    private final JpaGoogleOAuthTokenRepository jpa;
    private final TokenEncryptionService tokenEncryption;

    public GoogleOAuthTokenAdapter(JpaGoogleOAuthTokenRepository jpa, TokenEncryptionService tokenEncryption) {
        this.jpa = jpa;
        this.tokenEncryption = tokenEncryption;
    }

    @Override
    public Optional<GoogleOAuthToken> findByCoupleId(UUID coupleId) {
        return jpa.findByCoupleId(coupleId).map(this::toDomain);
    }

    @Override
    public GoogleOAuthToken save(GoogleOAuthToken token) {
        GoogleOAuthTokenEntity entity = toEntity(token);
        return toDomain(jpa.save(entity));
    }

    @Override
    @Transactional
    public void deleteByCoupleId(UUID coupleId) {
        jpa.deleteByCoupleId(coupleId);
    }

    public long countLegacyPlaintextTokens() {
        return jpa.countLegacyPlaintextTokens();
    }

    private GoogleOAuthToken toDomain(GoogleOAuthTokenEntity e) {
        if (!tokenEncryption.isEncrypted(e.getAccessToken()) || !tokenEncryption.isEncrypted(e.getRefreshToken())) {
            log.warn("legacy plaintext oauth token read, will be encrypted on next save, coupleId={}", e.getCoupleId());
        }
        return new GoogleOAuthToken(
                e.getId(), e.getCoupleId(),
                tokenEncryption.decrypt(e.getAccessToken()), tokenEncryption.decrypt(e.getRefreshToken()),
                e.getTokenType(), e.getExpiresAt(),
                e.getGoogleEmail(), e.getScope(),
                e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private GoogleOAuthTokenEntity toEntity(GoogleOAuthToken t) {
        GoogleOAuthTokenEntity e = new GoogleOAuthTokenEntity();
        e.setId(t.id());
        e.setCoupleId(t.coupleId());
        e.setAccessToken(tokenEncryption.encrypt(t.accessToken()));
        e.setRefreshToken(tokenEncryption.encrypt(t.refreshToken()));
        e.setTokenType(t.tokenType() != null ? t.tokenType() : "Bearer");
        e.setExpiresAt(t.expiresAt());
        e.setGoogleEmail(t.googleEmail());
        e.setScope(t.scope());
        e.setCreatedAt(t.createdAt());
        e.setUpdatedAt(t.updatedAt());
        return e;
    }
}
