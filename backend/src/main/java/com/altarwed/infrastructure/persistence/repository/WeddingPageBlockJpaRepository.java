package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.domain.model.BlockTab;
import com.altarwed.infrastructure.persistence.entity.WeddingPageBlockEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface WeddingPageBlockJpaRepository extends JpaRepository<WeddingPageBlockEntity, UUID> {

    List<WeddingPageBlockEntity> findAllByWeddingWebsiteIdOrderByTabAscSortOrderAsc(UUID weddingWebsiteId);

    List<WeddingPageBlockEntity> findAllByWeddingWebsiteIdAndTabOrderBySortOrderAsc(
            UUID weddingWebsiteId, BlockTab tab);

    long countByWeddingWebsiteIdAndTab(UUID weddingWebsiteId, BlockTab tab);

    // COALESCE(MAX(...), 0) returns 0 when the (website, tab) pair has no rows yet
    // so the caller never has to handle a null. Avoids count-based math which
    // collides after a middle-of-list deletion.
    @Query("SELECT COALESCE(MAX(b.sortOrder), 0) FROM WeddingPageBlockEntity b " +
           "WHERE b.weddingWebsiteId = :websiteId AND b.tab = :tab")
    int findMaxSortOrderByWeddingWebsiteIdAndTab(
            @Param("websiteId") UUID websiteId, @Param("tab") BlockTab tab);
}
