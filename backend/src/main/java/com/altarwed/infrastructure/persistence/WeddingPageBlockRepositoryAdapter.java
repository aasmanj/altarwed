package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.BlockTab;
import com.altarwed.domain.model.WeddingPageBlock;
import com.altarwed.domain.port.WeddingPageBlockRepository;
import com.altarwed.infrastructure.persistence.entity.WeddingPageBlockEntity;
import com.altarwed.infrastructure.persistence.repository.WeddingPageBlockJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class WeddingPageBlockRepositoryAdapter implements WeddingPageBlockRepository {

    private final WeddingPageBlockJpaRepository jpa;

    @Override
    public WeddingPageBlock save(WeddingPageBlock block) {
        return toDomain(jpa.save(toEntity(block)));
    }

    @Override
    public List<WeddingPageBlock> saveAll(List<WeddingPageBlock> blocks) {
        return jpa.saveAll(blocks.stream().map(this::toEntity).toList())
                .stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<WeddingPageBlock> findById(UUID id) {
        return jpa.findById(id).map(this::toDomain);
    }

    @Override
    public List<WeddingPageBlock> findAllByWebsiteId(UUID websiteId) {
        return jpa.findAllByWeddingWebsiteIdOrderByTabAscSortOrderAsc(websiteId)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<WeddingPageBlock> findAllByWebsiteIdAndTab(UUID websiteId, BlockTab tab) {
        return jpa.findAllByWeddingWebsiteIdAndTabOrderBySortOrderAsc(websiteId, tab)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public long countByWebsiteIdAndTab(UUID websiteId, BlockTab tab) {
        return jpa.countByWeddingWebsiteIdAndTab(websiteId, tab);
    }

    @Override
    public int findMaxSortOrderByWebsiteIdAndTab(UUID websiteId, BlockTab tab) {
        return jpa.findMaxSortOrderByWeddingWebsiteIdAndTab(websiteId, tab);
    }

    @Override
    public void deleteById(UUID id) {
        jpa.deleteById(id);
    }

    private WeddingPageBlock toDomain(WeddingPageBlockEntity e) {
        return new WeddingPageBlock(
                e.getId(), e.getWeddingWebsiteId(), e.getTab(), e.getBlockType(),
                e.getSortOrder(), e.getContentJson(),
                e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private WeddingPageBlockEntity toEntity(WeddingPageBlock b) {
        return WeddingPageBlockEntity.builder()
                .id(b.id())
                .weddingWebsiteId(b.weddingWebsiteId())
                .tab(b.tab())
                .blockType(b.type())
                .sortOrder(b.sortOrder())
                .contentJson(b.contentJson())
                .createdAt(b.createdAt())
                .updatedAt(b.updatedAt())
                .build();
    }
}
