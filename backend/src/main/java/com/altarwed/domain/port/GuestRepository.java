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

    // Campaign reminder targets (issue #458): guests of this couple with a usable email whose
    // matching reminder has not been sent yet. Nonresponder targets are still PENDING; attending
    // targets are ATTENDING. The scheduler has already narrowed to couples inside the date window.
    List<Guest> findNonresponderReminderTargets(UUID coupleId);
    List<Guest> findAttendingReminderTargets(UUID coupleId);
    // Saves a list of guests atomically (used when creating a new party).
    List<Guest> saveAll(List<Guest> guests);
    // Returns guests for a couple whose name contains the search term (case-insensitive).
    List<Guest> findByCoupleIdAndNameContaining(UUID coupleId, String name);
    // Stamps save_the_date_sent_at = sentAt for the given guests in a single bulk
    // UPDATE, so a 200-guest send is one statement rather than 200 row saves.
    void markSaveTheDatesSent(Collection<UUID> guestIds, LocalDateTime sentAt);

    // Seating-table delete reindex (bulk, no entity hydration). A guest's seat is a 1-based
    // position into the couple's sortOrder-ordered table list; deleting a table at `position`
    // unassigns guests seated there and shifts later guests down one. Callers MUST invoke
    // unassign before shift (see the JPA query note). Each returns the affected row count.
    int unassignGuestsAtTablePosition(UUID coupleId, int position);
    int shiftGuestsAfterTablePosition(UUID coupleId, int position);
}
