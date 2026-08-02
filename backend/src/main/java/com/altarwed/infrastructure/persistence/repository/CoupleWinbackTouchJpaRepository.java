package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.CoupleWinbackTouchEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CoupleWinbackTouchJpaRepository extends JpaRepository<CoupleWinbackTouchEntity, UUID> {

    // All touches already recorded for a couple. The clustered unique index on
    // (couple_id, touch) makes this a tight seek. Returns entities; the adapter projects the
    // touch strings into the domain enum set.
    List<CoupleWinbackTouchEntity> findByCoupleId(UUID coupleId);
}
