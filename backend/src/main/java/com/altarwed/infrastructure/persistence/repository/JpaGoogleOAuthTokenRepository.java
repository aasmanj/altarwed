package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.GoogleOAuthTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface JpaGoogleOAuthTokenRepository extends JpaRepository<GoogleOAuthTokenEntity, UUID> {
    Optional<GoogleOAuthTokenEntity> findByCoupleId(UUID coupleId);
    void deleteByCoupleId(UUID coupleId);
}
