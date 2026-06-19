package com.altarwed.domain.port;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;

public interface EmailSuppressionPort {

    boolean isSuppressed(String emailHash);

    void suppress(String emailHash, String source);

    /**
     * The suppression source (USER_REQUEST / BOUNCE / COMPLAINT) for a hash, or
     * empty when the address is not suppressed. Lets a resubscribe decision branch
     * on why the address was suppressed in the first place.
     */
    Optional<String> suppressionSource(String emailHash);

    /**
     * Batch lookup: maps each currently-suppressed hash in the input to its source.
     * Hashes that are not suppressed are simply absent from the result. One query so
     * the guest list can flag unsubscribed guests without an N+1 of existence checks.
     */
    Map<String, String> suppressionSources(Collection<String> emailHashes);

    /**
     * Removes a hash from the suppression list (resubscribe) and records the reversal
     * in the audit trail under the given initiator source (e.g. COUPLE_REQUEST).
     * Returns true when a row was actually removed, false when the address was not
     * suppressed (in which case nothing is audited).
     */
    boolean unsuppress(String emailHash, String source);
}
