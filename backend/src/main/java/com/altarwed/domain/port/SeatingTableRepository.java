package com.altarwed.domain.port;

import com.altarwed.domain.model.SeatingTable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SeatingTableRepository {
    SeatingTable save(SeatingTable table);
    Optional<SeatingTable> findById(UUID id);
    List<SeatingTable> findAllByCoupleId(UUID coupleId);
    void deleteById(UUID id);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
}
