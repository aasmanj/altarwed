package com.altarwed.domain.port;

import com.altarwed.domain.model.BlockTab;
import com.altarwed.domain.model.WeddingPageBlock;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeddingPageBlockRepository {
    WeddingPageBlock save(WeddingPageBlock block);
    List<WeddingPageBlock> saveAll(List<WeddingPageBlock> blocks);
    Optional<WeddingPageBlock> findById(UUID id);
    List<WeddingPageBlock> findAllByWebsiteId(UUID websiteId);
    List<WeddingPageBlock> findAllByWebsiteIdAndTab(UUID websiteId, BlockTab tab);
    long countByWebsiteIdAndTab(UUID websiteId, BlockTab tab);
    // Returns the highest sortOrder currently on (websiteId, tab), or 0 if none.
    // Used by the create-block path so the new block is appended after any existing
    // ones, count-based math would collide after a middle deletion.
    int findMaxSortOrderByWebsiteIdAndTab(UUID websiteId, BlockTab tab);
    void deleteById(UUID id);
}
