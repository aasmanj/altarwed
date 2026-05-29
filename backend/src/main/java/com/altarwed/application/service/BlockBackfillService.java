package com.altarwed.application.service;

import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.BlockTab;
import com.altarwed.domain.model.BlockType;
import com.altarwed.domain.model.WeddingPageBlock;
import com.altarwed.domain.model.WeddingPartySide;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.WeddingPageBlockRepository;
import com.altarwed.domain.port.WeddingPartyMemberRepository;
import com.altarwed.domain.port.WeddingPhotoRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

// Seeds wedding_page_blocks rows from the existing scalar columns on wedding_websites
// (plus WeddingPartyMember + WeddingPhoto rows) so that couples who created their site
// before Phase 1 see a populated block editor on first entry. Idempotent per (website, tab):
// any tab that already has blocks is skipped, never duplicated. Designed to be called
// lazily from the editor on first load, no CommandLineRunner / one-shot ops job required.
@Service
public class BlockBackfillService {

    private static final int SORT_ORDER_STEP = 10;

    private final WeddingPageBlockRepository blockRepository;
    private final WeddingWebsiteRepository websiteRepository;
    private final WeddingPartyMemberRepository partyMemberRepository;
    private final WeddingPhotoRepository photoRepository;
    private final ObjectMapper objectMapper;

    public BlockBackfillService(
            WeddingPageBlockRepository blockRepository,
            WeddingWebsiteRepository websiteRepository,
            WeddingPartyMemberRepository partyMemberRepository,
            WeddingPhotoRepository photoRepository,
            ObjectMapper objectMapper
    ) {
        this.blockRepository = blockRepository;
        this.websiteRepository = websiteRepository;
        this.partyMemberRepository = partyMemberRepository;
        this.photoRepository = photoRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public BackfillReport backfill(UUID websiteId) {
        WeddingWebsite website = websiteRepository.findById(websiteId)
                .orElseThrow(() -> new WeddingWebsiteNotFoundException(websiteId.toString()));

        Set<BlockTab> tabsWithBlocks = EnumSet.noneOf(BlockTab.class);
        for (WeddingPageBlock existing : blockRepository.findAllByWebsiteId(websiteId)) {
            tabsWithBlocks.add(existing.tab());
        }

        List<WeddingPageBlock> toCreate = new ArrayList<>();

        if (!tabsWithBlocks.contains(BlockTab.OUR_STORY)) {
            toCreate.addAll(buildOurStoryBlocks(website));
        }
        if (!tabsWithBlocks.contains(BlockTab.DETAILS)) {
            toCreate.addAll(buildDetailsBlocks(website));
        }
        if (!tabsWithBlocks.contains(BlockTab.TRAVEL)) {
            toCreate.addAll(buildTravelBlocks(website));
        }
        if (!tabsWithBlocks.contains(BlockTab.REGISTRY)) {
            toCreate.addAll(buildRegistryBlocks(website));
        }
        if (!tabsWithBlocks.contains(BlockTab.WEDDING_PARTY)) {
            toCreate.addAll(buildWeddingPartyBlocks(websiteId));
        }
        if (!tabsWithBlocks.contains(BlockTab.PHOTOS)) {
            toCreate.addAll(buildPhotosBlocks(websiteId));
        }
        if (!tabsWithBlocks.contains(BlockTab.HOME)) {
            toCreate.addAll(buildHomeBlocks(website));
        }
        if (!tabsWithBlocks.contains(BlockTab.RSVP)) {
            toCreate.addAll(buildRsvpBlocks(website));
        }

        if (toCreate.isEmpty()) {
            return new BackfillReport(websiteId, 0, List.copyOf(tabsWithBlocks));
        }
        List<WeddingPageBlock> saved = blockRepository.saveAll(toCreate);
        return new BackfillReport(websiteId, saved.size(), List.copyOf(tabsWithBlocks));
    }

    // ----- per-tab builders -----

    private List<WeddingPageBlock> buildHomeBlocks(WeddingWebsite w) {
        List<WeddingPageBlock> out = new ArrayList<>();
        out.add(block(w.id(), BlockTab.HOME, BlockType.COUNTDOWN, nextOrder(out), "{}"));
        if (isNotBlank(w.scriptureText())) {
            out.add(block(w.id(), BlockTab.HOME, BlockType.SCRIPTURE, nextOrder(out),
                    json(node -> {
                        node.put("reference", nullSafe(w.scriptureReference()));
                        node.put("text", w.scriptureText());
                        node.put("translation", "ESV");
                    })));
        }
        out.add(block(w.id(), BlockTab.HOME, BlockType.RSVP_CTA, nextOrder(out), "{}"));
        return out;
    }

    private List<WeddingPageBlock> buildOurStoryBlocks(WeddingWebsite w) {
        List<WeddingPageBlock> out = new ArrayList<>();
        if (isNotBlank(w.ourStory())) {
            out.add(block(w.id(), BlockTab.OUR_STORY, BlockType.HEADING, nextOrder(out),
                    json(node -> {
                        node.put("text", "Our Story");
                        node.put("level", 2);
                    })));
            out.add(block(w.id(), BlockTab.OUR_STORY, BlockType.TEXT, nextOrder(out),
                    json(node -> node.put("markdown", w.ourStory()))));
        }
        return out;
    }

    private List<WeddingPageBlock> buildDetailsBlocks(WeddingWebsite w) {
        List<WeddingPageBlock> out = new ArrayList<>();
        out.add(block(w.id(), BlockTab.DETAILS, BlockType.VENUE_CARD, nextOrder(out), "{}"));
        // Scripture belongs on HOME, not DETAILS. Putting it in both tabs caused
        // couples to see a duplicate after the default backfill. DETAILS is for
        // logistics (venue, time, dress code), not worship content.
        return out;
    }

    private List<WeddingPageBlock> buildTravelBlocks(WeddingWebsite w) {
        List<WeddingPageBlock> out = new ArrayList<>();
        if (isNotBlank(w.hotelName())) {
            out.add(block(w.id(), BlockTab.TRAVEL, BlockType.HOTEL_CARD, nextOrder(out), "{}"));
        }
        return out;
    }

    private List<WeddingPageBlock> buildRegistryBlocks(WeddingWebsite w) {
        List<WeddingPageBlock> out = new ArrayList<>();
        if (isNotBlank(w.registryUrl1())) {
            out.add(block(w.id(), BlockTab.REGISTRY, BlockType.REGISTRY_CARD, nextOrder(out),
                    json(node -> node.put("slot", 1))));
        }
        if (isNotBlank(w.registryUrl2())) {
            out.add(block(w.id(), BlockTab.REGISTRY, BlockType.REGISTRY_CARD, nextOrder(out),
                    json(node -> node.put("slot", 2))));
        }
        if (isNotBlank(w.registryUrl3())) {
            out.add(block(w.id(), BlockTab.REGISTRY, BlockType.REGISTRY_CARD, nextOrder(out),
                    json(node -> node.put("slot", 3))));
        }
        return out;
    }

    private List<WeddingPageBlock> buildWeddingPartyBlocks(UUID websiteId) {
        List<WeddingPageBlock> out = new ArrayList<>();
        var members = partyMemberRepository.findAllByWeddingWebsiteId(websiteId);
        boolean hasBride = members.stream().anyMatch(m -> m.side() == WeddingPartySide.BRIDE);
        boolean hasGroom = members.stream().anyMatch(m -> m.side() == WeddingPartySide.GROOM);
        if (hasBride) {
            out.add(block(websiteId, BlockTab.WEDDING_PARTY, BlockType.WEDDING_PARTY_GRID, nextOrder(out),
                    json(node -> node.put("side", "BRIDE"))));
        }
        if (hasGroom) {
            out.add(block(websiteId, BlockTab.WEDDING_PARTY, BlockType.WEDDING_PARTY_GRID, nextOrder(out),
                    json(node -> node.put("side", "GROOM"))));
        }
        return out;
    }

    private List<WeddingPageBlock> buildPhotosBlocks(UUID websiteId) {
        List<WeddingPageBlock> out = new ArrayList<>();
        if (!photoRepository.findAllByWeddingWebsiteId(websiteId).isEmpty()) {
            out.add(block(websiteId, BlockTab.PHOTOS, BlockType.PHOTO_ALBUM_GRID, nextOrder(out), "{}"));
        }
        return out;
    }

    private List<WeddingPageBlock> buildRsvpBlocks(WeddingWebsite w) {
        List<WeddingPageBlock> out = new ArrayList<>();
        out.add(block(w.id(), BlockTab.RSVP, BlockType.RSVP_CTA, nextOrder(out), "{}"));
        return out;
    }

    // ----- helpers -----

    private WeddingPageBlock block(UUID websiteId, BlockTab tab, BlockType type, int sortOrder, String contentJson) {
        var now = LocalDateTime.now();
        return new WeddingPageBlock(null, websiteId, tab, type, sortOrder, contentJson, now, now);
    }

    // Counts only the blocks already in `out` for the same tab; safe because each builder
    // returns a single tab's worth of blocks.
    private int nextOrder(List<WeddingPageBlock> out) {
        return (out.size() + 1) * SORT_ORDER_STEP;
    }

    private boolean isNotBlank(String s) {
        return s != null && !s.isBlank();
    }

    private String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private String json(java.util.function.Consumer<ObjectNode> builder) {
        ObjectNode node = objectMapper.createObjectNode();
        builder.accept(node);
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize block content JSON", e);
        }
    }

    public record BackfillReport(UUID websiteId, int blocksCreated, List<BlockTab> tabsSkipped) {}
}
