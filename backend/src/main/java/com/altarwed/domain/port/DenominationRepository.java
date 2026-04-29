package com.altarwed.domain.port;

import com.altarwed.domain.model.Denomination;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DenominationRepository {

    Denomination save(Denomination denomination);

    Optional<Denomination> findById(UUID id);

    Optional<Denomination> findBySlug(String slug);

    List<Denomination> findAll();

    boolean existsBySlug(String slug);
}
