package com.altarwed.domain.port;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

/**
 * Per-couple (per-wedding) voluntary email opt-outs. A guest who unsubscribes from one
 * couple's wedding mail is opted out only for that couple; a different couple can still
 * email them. Resubscribe is recipient-initiated (the guest RSVPs). Address-level
 * deliverability suppression (bounce/complaint) is separate, see {@link EmailSuppressionPort}.
 */
public interface CoupleEmailOptOutPort {

    boolean isOptedOut(UUID coupleId, String emailHash);

    void optOut(UUID coupleId, String emailHash);

    /** Removes the opt-out (resubscribe). Returns true when a row was removed. */
    boolean removeOptOut(UUID coupleId, String emailHash);

    /**
     * Batch: of the given hashes, which are opted out for this couple. One query so the
     * guest list can flag unsubscribed guests without an N+1.
     */
    Set<String> optedOutHashes(UUID coupleId, Collection<String> emailHashes);
}
