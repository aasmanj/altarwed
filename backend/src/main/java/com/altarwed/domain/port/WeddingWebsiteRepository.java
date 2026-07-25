package com.altarwed.domain.port;

import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.model.WeddingWebsiteSummary;

import java.time.LocalDate;
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

    // Slim projection for the sitemap: only slug + updatedAt per published, non-deleted
    // site. Never hydrates the full WeddingWebsite (see WeddingWebsiteSummary). Returns a
    // single, id-ordered page (issue #241) so the unauthenticated feed never streams the
    // whole published-sites table; the sitemap loader iterates pages until one comes back
    // short. Page is zero-based.
    List<WeddingWebsiteSummary> findPublishedSummaries(int page, int size);

    boolean existsBySlug(String slug);

    boolean existsByCoupleId(UUID coupleId);

    List<WeddingWebsite> searchPublishedByNameAndYear(String name, Integer year);

    // Non-deleted weddings whose date falls within [start, end] inclusive. Backs the hourly
    // CampaignReminderService (issue #458), which processes only the couples entering a campaign
    // window (about 30 days out, about 7 days out), never the whole table.
    List<WeddingWebsite> findByWeddingDateBetween(LocalDate start, LocalDate end);
}
