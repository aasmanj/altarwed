package com.altarwed.domain.exception;

import java.util.UUID;

/**
 * Raised when Google rejects a refresh token with {@code invalid_grant}
 * ("Token has been expired or revoked"). This is unrecoverable without the
 * couple re-authorizing: refresh tokens for apps in the OAuth "Testing"
 * publishing status expire after 7 days, and a user can revoke access at any
 * time. The scheduled sync treats this as a terminal condition (deactivate +
 * surface a reconnect prompt), not a transient error to retry every poll.
 */
public class GoogleAuthRevokedException extends RuntimeException {
    public GoogleAuthRevokedException(UUID coupleId) {
        super("Google access revoked or expired for coupleId=" + coupleId);
    }
}
