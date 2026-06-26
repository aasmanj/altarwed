package com.altarwed.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

public record RsvpInviteToken(
        UUID id,
        String tokenHash,
        UUID guestId,
        LocalDateTime expiresAt,
        boolean used,
        LocalDateTime usedAt,
        // How the token was minted. Lets the public find-invitation search rotate its own
        // short-lived (1-hour) token in place instead of inserting a new row on every name
        // guess, while never touching a 30-day email-invite token so the emailed link keeps
        // working. Legacy rows persist as null and are never rotated.
        String source
) {
    // Minted by the public "find your invitation" name search (short-lived, rotatable).
    public static final String SOURCE_SEARCH = "SEARCH";
    // Minted by an authenticated couple sending an email invite (long-lived, never rotated).
    public static final String SOURCE_INVITE = "INVITE";

    public boolean isValid() {
        return !used && expiresAt.isAfter(LocalDateTime.now());
    }
}
