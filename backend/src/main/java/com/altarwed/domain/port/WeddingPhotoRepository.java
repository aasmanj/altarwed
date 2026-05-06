package com.altarwed.domain.port;

import com.altarwed.domain.model.WeddingPhoto;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeddingPhotoRepository {
    WeddingPhoto save(WeddingPhoto photo);
    List<WeddingPhoto> findAllByWeddingWebsiteId(UUID weddingWebsiteId);
    Optional<WeddingPhoto> findById(UUID id);
    void deleteById(UUID id);
    boolean existsByIdAndWeddingWebsiteId(UUID id, UUID weddingWebsiteId);
}
