package com.altarwed.domain.port;

import com.altarwed.domain.model.Guest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GuestRepository {
    Guest save(Guest guest);
    List<Guest> findAllByCoupleId(UUID coupleId);
    Optional<Guest> findById(UUID id);
    void deleteById(UUID id);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
}
