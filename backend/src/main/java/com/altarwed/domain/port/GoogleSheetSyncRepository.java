package com.altarwed.domain.port;

import com.altarwed.domain.model.GoogleSheetSync;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GoogleSheetSyncRepository {
    Optional<GoogleSheetSync> findByCoupleId(UUID coupleId);
    GoogleSheetSync save(GoogleSheetSync sync);
    void deleteByCoupleId(UUID coupleId);
    // Returns all active sync configs for the scheduler.
    List<GoogleSheetSync> findAllActive();
}
