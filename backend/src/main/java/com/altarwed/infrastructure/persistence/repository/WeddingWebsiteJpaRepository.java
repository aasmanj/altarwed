package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.WeddingWebsiteEntity;
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

    List<WeddingWebsiteEntity> findAllByIsPublishedTrueAndIsDeletedFalse();

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
            @Param("yearEnd")   LocalDate yearEnd
    );
}
