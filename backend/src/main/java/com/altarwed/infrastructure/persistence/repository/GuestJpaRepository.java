package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.GuestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface GuestJpaRepository extends JpaRepository<GuestEntity, UUID> {
    List<GuestEntity> findAllByCoupleId(UUID coupleId);
    boolean existsByIdAndCoupleId(UUID id, UUID coupleId);
}
