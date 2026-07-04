package com.altarwed.application.service;

import com.altarwed.application.dto.CreateWeddingPageBlockRequest;
import com.altarwed.application.dto.ReorderBlocksRequest;
import com.altarwed.application.dto.UpdateWeddingPageBlockRequest;
import com.altarwed.domain.exception.WeddingPageBlockNotFoundException;
import com.altarwed.domain.model.BlockTab;
import com.altarwed.domain.model.WeddingPageBlock;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.RevalidationPort;
import com.altarwed.domain.port.WeddingPageBlockRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class WeddingPageBlockService {

    // Spacing the seeded sortOrder by 10 leaves room to insert blocks without renumbering.
    private static final int SORT_ORDER_STEP = 10;

    private final WeddingPageBlockRepository blockRepository;
    private final WeddingWebsiteRepository websiteRepository;
    private final RevalidationPort revalidationPort;

    public WeddingPageBlockService(
            WeddingPageBlockRepository blockRepository,
            WeddingWebsiteRepository websiteRepository,
            RevalidationPort revalidationPort
    ) {
        this.blockRepository = blockRepository;
        this.websiteRepository = websiteRepository;
        this.revalidationPort = revalidationPort;
    }

    @Transactional(readOnly = true)
    public List<WeddingPageBlock> listByWebsite(UUID websiteId) {
        return blockRepository.findAllByWebsiteId(websiteId);
    }

    @Transactional(readOnly = true)
    public List<WeddingPageBlock> listByWebsiteAndTab(UUID websiteId, BlockTab tab) {
        return blockRepository.findAllByWebsiteIdAndTab(websiteId, tab);
    }

    @Transactional
    public WeddingPageBlock create(UUID websiteId, CreateWeddingPageBlockRequest req) {
        // Append at MAX(sortOrder) + STEP. Count-based math would collide after a
        // middle-of-list deletion (3 blocks at 10/20/30, delete middle → count=2 →
        // (2+1)*10 = 30, which already exists). MAX is collision-free even if the
        // sort_order column ever gets a unique constraint.
        int maxSortOrder = blockRepository.findMaxSortOrderByWebsiteIdAndTab(websiteId, req.tab());
        int sortOrder = maxSortOrder + SORT_ORDER_STEP;

        WeddingPageBlock block = new WeddingPageBlock(
                null, websiteId, req.tab(), req.type(),
                sortOrder, req.contentJson(),
                LocalDateTime.now(), LocalDateTime.now()
        );
        WeddingPageBlock saved = blockRepository.save(block);
        revalidateOwningPage(websiteId);
        return saved;
    }

    @Transactional
    public WeddingPageBlock update(UUID websiteId, UUID blockId, UpdateWeddingPageBlockRequest req) {
        WeddingPageBlock existing = getBlock(websiteId, blockId);
        WeddingPageBlock updated = new WeddingPageBlock(
                existing.id(), existing.weddingWebsiteId(), existing.tab(), existing.type(),
                existing.sortOrder(), req.contentJson(),
                existing.createdAt(), LocalDateTime.now()
        );
        WeddingPageBlock saved = blockRepository.save(updated);
        revalidateOwningPage(websiteId);
        return saved;
    }

    @Transactional
    public void delete(UUID websiteId, UUID blockId) {
        getBlock(websiteId, blockId); // throws if not found / wrong website
        blockRepository.deleteById(blockId);
        revalidateOwningPage(websiteId);
    }

    @Transactional
    public List<WeddingPageBlock> reorder(UUID websiteId, BlockTab tab, ReorderBlocksRequest req) {
        List<WeddingPageBlock> current = blockRepository.findAllByWebsiteIdAndTab(websiteId, tab);
        Map<UUID, WeddingPageBlock> byId = new HashMap<>();
        for (WeddingPageBlock b : current) byId.put(b.id(), b);

        int sortOrder = SORT_ORDER_STEP;
        List<WeddingPageBlock> toSave = new java.util.ArrayList<>();
        for (UUID id : req.orderedBlockIds()) {
            WeddingPageBlock existing = byId.get(id);
            // Silently skip ids that don't belong to this tab, defensive against stale clients.
            if (existing == null) continue;
            toSave.add(existing.withSortOrder(sortOrder));
            sortOrder += SORT_ORDER_STEP;
        }
        List<WeddingPageBlock> saved = blockRepository.saveAll(toSave);
        revalidateOwningPage(websiteId);
        return saved;
    }

    // -------------------------------------------------------------------------

    private WeddingPageBlock getBlock(UUID websiteId, UUID blockId) {
        WeddingPageBlock block = blockRepository.findById(blockId)
                .orElseThrow(() -> new WeddingPageBlockNotFoundException(blockId.toString()));
        if (!block.weddingWebsiteId().equals(websiteId)) {
            throw new WeddingPageBlockNotFoundException(blockId.toString());
        }
        return block;
    }

    // Trigger ISR revalidation for the owning wedding page after a block mutation, but only
    // when the site is published. An unpublished (draft) site has no live public page in the
    // Next.js ISR cache, so the public path 404s until the couple hits publish; firing a
    // revalidation request for a draft slug is a pointless HTTP round-trip plus log noise on
    // every keystroke-level edit during the pre-launch build phase. Gating on isPublished
    // matches the intent of the scalar update path (WeddingWebsiteService), where a draft's
    // slug is not a live cached route.
    private void revalidateOwningPage(UUID websiteId) {
        websiteRepository.findById(websiteId)
                .filter(WeddingWebsite::isPublished)
                .ifPresent(w -> revalidationPort.revalidateWeddingPage(w.slug()));
    }
}
