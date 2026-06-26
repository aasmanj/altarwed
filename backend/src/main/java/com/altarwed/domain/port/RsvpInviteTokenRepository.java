package com.altarwed.domain.port;

import com.altarwed.domain.model.RsvpInviteToken;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface RsvpInviteTokenRepository {
    RsvpInviteToken save(RsvpInviteToken token);
    Optional<RsvpInviteToken> findByTokenHash(String tokenHash);
    void deleteAllByGuestId(UUID guestId);
    void markUsed(String tokenHash);

    /**
     * The guest's most recent still-valid token minted by the public find-invitation search,
     * if any. Used to rotate that single row in place rather than minting a fresh row on every
     * name guess. Never returns an email-invite token, so the emailed link is left untouched.
     */
    Optional<RsvpInviteToken> findValidSearchToken(UUID guestId, LocalDateTime now);
}
