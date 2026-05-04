package com.altarwed.domain.port;

import com.altarwed.domain.model.WeddingWebsite;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeddingWebsiteRepository {

    WeddingWebsite save(WeddingWebsite website);

    Optional<WeddingWebsite> findById(UUID id);

    Optional<WeddingWebsite> findByCoupleId(UUID coupleId);

    Optional<WeddingWebsite> findBySlug(String slug);

    List<WeddingWebsite> findAllPublished();

    boolean existsBySlug(String slug);

    boolean existsByCoupleId(UUID coupleId);
}
