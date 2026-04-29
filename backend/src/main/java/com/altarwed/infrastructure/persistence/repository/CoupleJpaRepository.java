package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.CoupleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CoupleJpaRepository extends JpaRepository<CoupleEntity, UUID> {

    Optional<CoupleEntity> findByEmail(String email);

    boolean existsByEmail(String email);
}
