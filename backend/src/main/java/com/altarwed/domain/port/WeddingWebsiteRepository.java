package com.altarwed.domain.port;

import com.altarwed.domain.model.WeddingWebsite;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeddingWebsiteRepository {

    // Hard server-side cap on public, unauthenticated search results. A blank-filter
    // request must never stream the whole published-sites table (egress / DoS vector),
    // so the adapter pages the query to this many rows and the service trims defensively.
    int MAX_SEARCH_RESULTS = 100;

    WeddingWebsite save(WeddingWebsite website);

    Optional<WeddingWebsite> findById(UUID id);

    Optional<WeddingWebsite> findByCoupleId(UUID coupleId);

    Optional<WeddingWebsite> findBySlug(String slug);

    List<WeddingWebsite> findAllPublished();

    boolean existsBySlug(String slug);

    boolean existsByCoupleId(UUID coupleId);

    List<WeddingWebsite> searchPublishedByNameAndYear(String name, Integer year);
}
