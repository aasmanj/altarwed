package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.GoogleOAuthToken;
import com.altarwed.domain.port.GoogleOAuthTokenRepository;
import com.altarwed.infrastructure.persistence.entity.GoogleOAuthTokenEntity;
import com.altarwed.infrastructure.persistence.repository.JpaGoogleOAuthTokenRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Component
public class GoogleOAuthTokenAdapter implements GoogleOAuthTokenRepository {

    private final JpaGoogleOAuthTokenRepository jpa;

    public GoogleOAuthTokenAdapter(JpaGoogleOAuthTokenRepository jpa) {
        this.jpa = jpa;
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

    private GoogleOAuthToken toDomain(GoogleOAuthTokenEntity e) {
        return new GoogleOAuthToken(
                e.getId(), e.getCoupleId(),
                e.getAccessToken(), e.getRefreshToken(),
                e.getTokenType(), e.getExpiresAt(),
                e.getGoogleEmail(), e.getScope(),
                e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private GoogleOAuthTokenEntity toEntity(GoogleOAuthToken t) {
        GoogleOAuthTokenEntity e = new GoogleOAuthTokenEntity();
        e.setId(t.id());
        e.setCoupleId(t.coupleId());
        e.setAccessToken(t.accessToken());
        e.setRefreshToken(t.refreshToken());
        e.setTokenType(t.tokenType() != null ? t.tokenType() : "Bearer");
        e.setExpiresAt(t.expiresAt());
        e.setGoogleEmail(t.googleEmail());
        e.setScope(t.scope());
        e.setCreatedAt(t.createdAt());
        e.setUpdatedAt(t.updatedAt());
        return e;
    }
}
