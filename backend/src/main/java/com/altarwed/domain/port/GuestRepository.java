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
}
