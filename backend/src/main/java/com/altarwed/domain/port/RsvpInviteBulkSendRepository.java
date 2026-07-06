package com.altarwed.domain.port;

import com.altarwed.domain.model.RsvpInviteBulkSend;

import java.util.Optional;
import java.util.UUID;

/**
 * Persistence port for bulk RSVP invite idempotency receipts (issue #295). The single
 * write ({@link #save}) claims the (coupleId, idempotencyKey) pair in a unique index;
 * a racing duplicate submit with the same key fails that insert, which the service
 * catches and turns into a replay. Couple deletion is handled by the FK's ON DELETE
 * CASCADE, so no delete method is needed here. Mirrors {@link SaveTheDateSendRepository}.
 */
public interface RsvpInviteBulkSendRepository {

    /**
     * Persists one receipt, claiming its (coupleId, idempotencyKey) in the unique index.
     * Implementations MUST flush eagerly so a unique-constraint violation surfaces at this
     * call (as a Spring DataIntegrityViolationException) rather than being deferred to the
     * caller's transaction commit, where the service could not turn it into a replay.
     */
    RsvpInviteBulkSend save(RsvpInviteBulkSend send);

    Optional<RsvpInviteBulkSend> findByCoupleIdAndIdempotencyKey(UUID coupleId, String idempotencyKey);
}
