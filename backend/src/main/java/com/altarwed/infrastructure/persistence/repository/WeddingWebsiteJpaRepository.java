package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.WeddingWebsiteEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeddingWebsiteJpaRepository extends JpaRepository<WeddingWebsiteEntity, UUID> {

    Optional<WeddingWebsiteEntity> findByCoupleId(UUID coupleId);

    Optional<WeddingWebsiteEntity> findBySlug(String slug);

    // Closed interface projection: selects only slug + updated_at, never the full
    // entity. Backs the /published sitemap endpoint, which discards every other column.
    // Paged and ordered by id (issue #241) so the unauthenticated feed never loads the
    // whole published-sites table into memory, and so paging is stable (deterministic
    // ORDER BY) across the sequential page requests the sitemap loader makes.
    List<WeddingWebsiteSitemapProjection> findByIsPublishedTrueAndIsDeletedFalseOrderByIdAsc(Pageable pageable);

    boolean existsBySlug(String slug);

    boolean existsByCoupleId(UUID coupleId);

    @Query("""
            SELECT w FROM WeddingWebsiteEntity w
            WHERE w.isPublished = true AND w.isDeleted = false
            AND (:name IS NULL
                 OR LOWER(w.partnerOneName) LIKE LOWER(CONCAT('%', :name, '%'))
                 OR LOWER(w.partnerTwoName) LIKE LOWER(CONCAT('%', :name, '%')))
            AND (:yearStart IS NULL OR w.weddingDate >= :yearStart)
            AND (:yearEnd   IS NULL OR w.weddingDate <= :yearEnd)
            ORDER BY w.weddingDate ASC
            """)
    List<WeddingWebsiteEntity> searchPublished(
            @Param("name")      String name,
            @Param("yearStart") LocalDate yearStart,
            @Param("yearEnd")   LocalDate yearEnd,
            Pageable pageable
    );
}
