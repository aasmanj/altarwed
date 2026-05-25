package com.altarwed.domain.port;

import com.altarwed.domain.model.GoogleOAuthToken;

import java.util.Optional;
import java.util.UUID;

public interface GoogleOAuthTokenRepository {
    Optional<GoogleOAuthToken> findByCoupleId(UUID coupleId);
    GoogleOAuthToken save(GoogleOAuthToken token);
    void deleteByCoupleId(UUID coupleId);
}
