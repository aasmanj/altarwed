package com.altarwed.domain.port;

import com.altarwed.domain.model.Guest;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GuestRepository {
    Guest save(Guest guest);
    List<Guest> findAllByCoupleId(UUID coupleId);
    Optional<Guest> findById(UUID id);
    void deleteById(UUID id);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
    // Returns PENDING guests whose remind_at is on or before asOf and who are still below the
    // invite-send cap (invite_send_count < maxInviteSends). Used by RsvpReminderService. The cap
    // filter keeps a guest who deferred until they hit the cap from being retried (and failing
    // at the cap check) on every hourly run, forever (issue #233).
    List<Guest> findDueReminders(LocalDateTime asOf, int maxInviteSends);
    // Returns all guests in a party (same party_id), sorted by createdAt.
    List<Guest> findAllByPartyId(UUID partyId);
    // Saves a list of guests atomically (used when creating a new party).
    List<Guest> saveAll(List<Guest> guests);
    // Returns guests for a couple whose name contains the search term (case-insensitive).
    List<Guest> findByCoupleIdAndNameContaining(UUID coupleId, String name);
    // Stamps save_the_date_sent_at = sentAt for the given guests in a single bulk
    // UPDATE, so a 200-guest send is one statement rather than 200 row saves.
    void markSaveTheDatesSent(Collection<UUID> guestIds, LocalDateTime sentAt);
}
