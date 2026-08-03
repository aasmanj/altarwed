package com.altarwed.domain.port;

import com.altarwed.domain.model.Couple;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CoupleRepository {

    Couple save(Couple couple);

    Optional<Couple> findById(UUID id);

    // Active (not soft-deleted) couples whose signup timestamp falls within [from, to] inclusive.
    // Backs the hourly CoupleWinbackService (issue #551), which reads only the couples inside the
    // win-back age window (about 2 to 23 days old) rather than the whole couples table. isActive
    // false means the couple deleted their account, so they are excluded here (a win-back stop
    // condition) at the source.
    List<Couple> findActiveCreatedBetween(LocalDateTime from, LocalDateTime to);

    Optional<Couple> findByEmail(String email);

    boolean existsByEmail(String email);

    List<Couple> findAll();

    void deleteById(UUID id);
}
