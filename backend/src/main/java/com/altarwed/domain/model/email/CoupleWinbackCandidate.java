package com.altarwed.domain.model.email;

import java.util.UUID;

/**
 * A couple eligible for one touch of the win-back sequence (issue #551): registered, still
 * active, no published wedding website, and not already sent this touch.
 *
 * A narrow projection rather than the full {@code Couple} record on purpose. The job reads a
 * page of these every hour and needs only the address and the names the email renders, so
 * carrying the password hash and the rest of the account row through the scheduler would be
 * both wasteful and a needless widening of where credentials travel.
 */
public record CoupleWinbackCandidate(
        UUID coupleId,
        String email,
        String partnerOneName,
        String partnerTwoName
) {}
