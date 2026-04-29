package com.altarwed.domain.port;

import com.altarwed.domain.model.Couple;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CoupleRepository {

    Couple save(Couple couple);

    Optional<Couple> findById(UUID id);

    Optional<Couple> findByEmail(String email);

    boolean existsByEmail(String email);

    List<Couple> findAll();

    void deleteById(UUID id);
}
