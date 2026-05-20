package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.domain.model.BlockTab;
import com.altarwed.infrastructure.persistence.entity.WeddingPageBlockEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WeddingPageBlockJpaRepository extends JpaRepository<WeddingPageBlockEntity, UUID> {

    List<WeddingPageBlockEntity> findAllByWeddingWebsiteIdOrderByTabAscSortOrderAsc(UUID weddingWebsiteId);

    List<WeddingPageBlockEntity> findAllByWeddingWebsiteIdAndTabOrderBySortOrderAsc(
            UUID weddingWebsiteId, BlockTab tab);

    long countByWeddingWebsiteIdAndTab(UUID weddingWebsiteId, BlockTab tab);
}
