package com.altarwed.domain.port;

import com.altarwed.domain.model.WeddingPrayer;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeddingPrayerRepository {
    WeddingPrayer save(WeddingPrayer prayer);
    List<WeddingPrayer> findAllByWeddingWebsiteId(UUID weddingWebsiteId);
    Optional<WeddingPrayer> findById(UUID id);
    void deleteById(UUID id);
    boolean existsByIdAndWeddingWebsiteId(UUID id, UUID weddingWebsiteId);
}
