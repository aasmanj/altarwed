package com.altarwed.domain.port;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;

/**
 * Global, address-level suppression: deliverability facts (permanent BOUNCE, spam
 * COMPLAINT) that apply to an email address across every couple, protecting the shared
 * altarwed.com sending reputation. Voluntary per-wedding unsubscribes live separately in
 * {@link CoupleEmailOptOutPort}.
 */
public interface EmailSuppressionPort {

    boolean isSuppressed(String emailHash);

    void suppress(String emailHash, String source);

    /** The suppression source (USER_REQUEST / BOUNCE / COMPLAINT) for a hash, or empty. */
    Optional<String> suppressionSource(String emailHash);

    /**
     * Batch lookup: maps each currently-suppressed hash in the input to its source.
     * Not-suppressed hashes are absent from the result. One query so the guest list can
     * flag globally-suppressed guests without an N+1 of existence checks.
     */
    Map<String, String> suppressionSources(Collection<String> emailHashes);

    /**
     * Removes a LEGACY global USER_REQUEST opt-out (those predate the per-couple model)
     * when the recipient resubscribes by RSVPing. Deletes only a USER_REQUEST row, never
     * a BOUNCE/COMPLAINT, so a guest action can't clear a deliverability suppression.
     * Returns true when a row was removed.
     */
    boolean clearLegacyUserRequest(String emailHash);
}
