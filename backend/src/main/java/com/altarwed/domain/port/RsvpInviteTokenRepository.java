package com.altarwed.domain.port;

import com.altarwed.domain.model.RsvpInviteToken;

import java.util.Optional;
import java.util.UUID;

public interface RsvpInviteTokenRepository {
    RsvpInviteToken save(RsvpInviteToken token);
    Optional<RsvpInviteToken> findByTokenHash(String tokenHash);
    void deleteAllByGuestId(UUID guestId);
    void markUsed(String tokenHash);
}
