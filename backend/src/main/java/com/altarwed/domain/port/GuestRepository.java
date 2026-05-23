package com.altarwed.domain.port;

import com.altarwed.domain.model.Guest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GuestRepository {
    Guest save(Guest guest);
    List<Guest> findAllByCoupleId(UUID coupleId);
    Optional<Guest> findById(UUID id);
    void deleteById(UUID id);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
    // Returns PENDING guests whose remind_at is on or before asOf. Used by RsvpReminderService.
    List<Guest> findDueReminders(LocalDateTime asOf);
    // Returns all guests in a party (same party_id), sorted by createdAt.
    List<Guest> findAllByPartyId(UUID partyId);
    // Saves a list of guests atomically (used when creating a new party).
    List<Guest> saveAll(List<Guest> guests);
    // Returns guests for a couple whose name contains the search term (case-insensitive).
    List<Guest> findByCoupleIdAndNameContaining(UUID coupleId, String name);
}
