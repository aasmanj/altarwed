package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.GoogleSheetSync;
import com.altarwed.domain.port.GoogleSheetSyncRepository;
import com.altarwed.infrastructure.persistence.entity.GoogleSheetSyncEntity;
import com.altarwed.infrastructure.persistence.repository.GoogleSheetSyncJpaRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class GoogleSheetSyncRepositoryAdapter implements GoogleSheetSyncRepository {

    private final GoogleSheetSyncJpaRepository jpa;

    public GoogleSheetSyncRepositoryAdapter(GoogleSheetSyncJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public Optional<GoogleSheetSync> findByCoupleId(UUID coupleId) {
        return jpa.findByCoupleId(coupleId).map(this::toDomain);
    }

    @Override
    @Transactional
    public GoogleSheetSync save(GoogleSheetSync sync) {
        GoogleSheetSyncEntity entity = jpa.findByCoupleId(sync.coupleId())
                .map(e -> {
                    e.setSheetUrl(sync.sheetUrl());
                    e.setLastSynced(sync.lastSynced());
                    e.setLastError(sync.lastError());
                    e.setRowCount(sync.rowCount());
                    e.setActive(sync.isActive());
                    return e;
                })
                .orElseGet(() -> GoogleSheetSyncEntity.builder()
                        .coupleId(sync.coupleId())
                        .sheetUrl(sync.sheetUrl())
                        .lastSynced(sync.lastSynced())
                        .lastError(sync.lastError())
                        .rowCount(sync.rowCount())
                        .active(sync.isActive())
                        .build());
        return toDomain(jpa.save(entity));
    }

    @Override
    @Transactional
    public void deleteByCoupleId(UUID coupleId) {
        jpa.deleteByCoupleId(coupleId);
    }

    @Override
    public List<GoogleSheetSync> findAllActive() {
        return jpa.findAllByActiveTrue().stream().map(this::toDomain).toList();
    }

    private GoogleSheetSync toDomain(GoogleSheetSyncEntity e) {
        return new GoogleSheetSync(
                e.getId(),
                e.getCoupleId(),
                e.getSheetUrl(),
                e.getLastSynced(),
                e.getLastError(),
                e.getRowCount(),
                e.isActive(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
