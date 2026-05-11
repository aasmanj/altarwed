package com.altarwed.domain.port;

import com.altarwed.domain.model.CeremonySection;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CeremonySectionRepository {
    CeremonySection save(CeremonySection section);
    List<CeremonySection> findByCoupleIdOrderBySortOrder(UUID coupleId);
    Optional<CeremonySection> findById(UUID id);
    void deleteById(UUID id);
}
