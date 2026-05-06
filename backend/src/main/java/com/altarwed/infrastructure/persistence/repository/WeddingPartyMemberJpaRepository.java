package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.WeddingPartyMemberEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WeddingPartyMemberJpaRepository extends JpaRepository<WeddingPartyMemberEntity, UUID> {
    List<WeddingPartyMemberEntity> findAllByWeddingWebsiteIdOrderBySortOrderAscCreatedAtAsc(UUID weddingWebsiteId);
    boolean existsByIdAndWeddingWebsiteId(UUID id, UUID weddingWebsiteId);
}
