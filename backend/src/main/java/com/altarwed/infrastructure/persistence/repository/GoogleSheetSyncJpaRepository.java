package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.GoogleSheetSyncEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GoogleSheetSyncJpaRepository extends JpaRepository<GoogleSheetSyncEntity, UUID> {
    Optional<GoogleSheetSyncEntity> findByCoupleId(UUID coupleId);
    void deleteByCoupleId(UUID coupleId);
    List<GoogleSheetSyncEntity> findAllByActiveTrue();
}
