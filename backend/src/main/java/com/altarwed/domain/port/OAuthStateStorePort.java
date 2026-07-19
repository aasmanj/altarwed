package com.altarwed.domain.port;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/**
 * One-time store for OAuth 2.0 {@code state} tokens (the CSRF binding between the couple who
 * started an authorization flow and the provider callback that finishes it). The Google Sheets
 * connect flow issues a random state, sends the couple to Google with it, and must find that
 * exact state again when the callback returns; a state that is unknown, expired, or already
 * used means the callback is forged or replayed and must be rejected (issue #109).
 *
 * <p>This is a port because the storage location is a deployment concern, not a domain one:
 * on a single instance an in-process map is enough, but once the backend scales past one
 * instance the callback can land on a different instance than the one that issued the state,
 * so the store must be shared (Redis). The service layer depends only on this interface and
 * cannot tell the difference.
 *
 * <p>A plain domain port with no framework imports (hexagonal rule); adapters live in
 * infrastructure.
 */
public interface OAuthStateStorePort {

    /**
     * Records a freshly issued state token for the given couple. The entry must become
     * unconsumable once {@code timeToLive} has elapsed, whether or not the adapter physically
     * removes it at that moment.
     *
     * @param state      the random, single-use state token sent to the OAuth provider
     * @param coupleId   the couple who initiated the authorization flow
     * @param timeToLive how long the pending flow stays valid before the callback must be rejected
     */
    void store(String state, UUID coupleId, Duration timeToLive);

    /**
     * Atomically consumes a state token: returns the couple bound to it and removes it so a
     * second callback with the same state (a replay) gets {@link Optional#empty()}. Unknown and
     * expired states also return empty; callers treat all three cases identically as
     * {@code invalid_state}.
     */
    Optional<UUID> consume(String state);
}
