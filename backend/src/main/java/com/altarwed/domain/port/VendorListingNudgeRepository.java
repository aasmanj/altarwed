package com.altarwed.domain.port;

import java.util.UUID;

/**
 * Dedup ledger for the one-time vendor listing-completion nudge (issue #557).
 *
 * A vendor receives that nudge at most once, ever. This port records the fact, and the backing
 * table's unique constraint on vendor_id is what actually enforces it: {@link #markSent} is
 * called inside the same transaction as the outbox enqueue, so two racing instances both attempt
 * the insert, exactly one commits, and the loser's transaction rolls back together with its
 * outbox row. {@link #existsByVendorId} is the cheap read-side skip that keeps the common case
 * from even building an email.
 */
public interface VendorListingNudgeRepository {

    /** True when this vendor has already been sent (or queued) their listing-completion nudge. */
    boolean existsByVendorId(UUID vendorId);

    /**
     * Records that the nudge has been queued for this vendor. Throws when a receipt already
     * exists (the unique constraint), which is the intended race-loser behaviour: the caller's
     * transaction rolls back and no duplicate email is enqueued.
     */
    void markSent(UUID vendorId);
}
