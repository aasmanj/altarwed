package com.altarwed.application.service;

import com.altarwed.domain.model.BlockTab;
import com.altarwed.domain.model.BlockType;
import com.altarwed.domain.model.WeddingPageBlock;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.WeddingPageBlockRepository;
import com.altarwed.domain.port.WeddingPartyMemberRepository;
import com.altarwed.domain.port.WeddingPhotoRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link BlockBackfillService} Home-tab default seeding (issue #329).
 *
 * The Home tab is trimmed to functional/venue blocks, and a brand-new site's Home tab
 * is seeded with VENUE_CARD + COUNTDOWN + RSVP_CTA. Backfill is per-tab idempotent:
 * a tab that already has blocks is skipped and never re-seeded, while a tab with no
 * blocks is still seeded even if OTHER tabs already have content. These tests pin that
 * behaviour so a future edit cannot silently touch existing couples' Home pages.
 */
@ExtendWith(MockitoExtension.class)
class BlockBackfillServiceTest {

    @Mock private WeddingPageBlockRepository blockRepository;
    @Mock private WeddingWebsiteRepository websiteRepository;
    @Mock private WeddingPartyMemberRepository partyMemberRepository;
    @Mock private WeddingPhotoRepository photoRepository;

    @Captor private ArgumentCaptor<List<WeddingPageBlock>> saveCaptor;

    private BlockBackfillService service;

    private static final String SLUG = "grace-and-james";

    @BeforeEach
    void setUp() {
        // Real ObjectMapper: the per-tab builders serialize block content JSON, so a
        // mock would test nothing. Ports stay mocked to keep this a pure unit test.
        service = new BlockBackfillService(
                blockRepository, websiteRepository, partyMemberRepository,
                photoRepository, new ObjectMapper());
    }

    @Test
    void newSite_seedsHomeWithVenueCardCountdownAndRsvpCta() {
        UUID websiteId = UUID.randomUUID();
        stubEmptySite(websiteId);

        service.backfill(websiteId);

        List<BlockType> homeTypes = savedTypesForTab(BlockTab.HOME);
        // Exactly the trimmed functional set, in seed order, no primitives.
        assertThat(homeTypes).containsExactly(
                BlockType.VENUE_CARD, BlockType.COUNTDOWN, BlockType.RSVP_CTA);
    }

    @Test
    void seededHomeTab_isNotTouchedByBackfill() {
        UUID websiteId = UUID.randomUUID();
        // Home already arranged by the couple; other tabs left empty.
        when(websiteRepository.findById(websiteId))
                .thenReturn(Optional.of(website(websiteId)));
        when(blockRepository.findAllByWebsiteId(websiteId))
                .thenReturn(List.of(existingBlock(websiteId, BlockTab.HOME)));
        lenient().when(partyMemberRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of());
        lenient().when(photoRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of());
        when(blockRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        service.backfill(websiteId);

        // Backfill may seed other empty tabs, but must not add ANY Home block.
        assertThat(savedTypesForTab(BlockTab.HOME)).isEmpty();
    }

    @Test
    void contentOnOtherTabsButEmptyHome_stillSeedsHomeAndSkipsTheOtherTab() {
        UUID websiteId = UUID.randomUUID();
        // Details tab already has content; Home is empty. Per-tab (not per-website)
        // idempotency must still seed Home while leaving Details alone.
        when(websiteRepository.findById(websiteId))
                .thenReturn(Optional.of(website(websiteId)));
        when(blockRepository.findAllByWebsiteId(websiteId))
                .thenReturn(List.of(existingBlock(websiteId, BlockTab.DETAILS)));
        lenient().when(partyMemberRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of());
        lenient().when(photoRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of());
        when(blockRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        service.backfill(websiteId);

        assertThat(savedTypesForTab(BlockTab.HOME))
                .containsExactly(BlockType.VENUE_CARD, BlockType.COUNTDOWN, BlockType.RSVP_CTA);
        // The already-populated Details tab is skipped, not re-seeded.
        assertThat(savedTypesForTab(BlockTab.DETAILS)).isEmpty();
    }

    @Test
    void alreadyFullySeededSite_savesNothing() {
        UUID websiteId = UUID.randomUUID();
        when(websiteRepository.findById(websiteId))
                .thenReturn(Optional.of(website(websiteId)));
        List<WeddingPageBlock> everyTab = List.of(
                existingBlock(websiteId, BlockTab.HOME),
                existingBlock(websiteId, BlockTab.OUR_STORY),
                existingBlock(websiteId, BlockTab.DETAILS),
                existingBlock(websiteId, BlockTab.WEDDING_PARTY),
                existingBlock(websiteId, BlockTab.REGISTRY),
                existingBlock(websiteId, BlockTab.TRAVEL),
                existingBlock(websiteId, BlockTab.PHOTOS),
                existingBlock(websiteId, BlockTab.RSVP));
        when(blockRepository.findAllByWebsiteId(websiteId)).thenReturn(everyTab);

        service.backfill(websiteId);

        verify(blockRepository, never()).saveAll(any());
    }

    // ----- helpers -----

    private void stubEmptySite(UUID websiteId) {
        when(websiteRepository.findById(websiteId)).thenReturn(Optional.of(website(websiteId)));
        when(blockRepository.findAllByWebsiteId(websiteId)).thenReturn(List.of());
        lenient().when(partyMemberRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of());
        lenient().when(photoRepository.findAllByWeddingWebsiteId(websiteId)).thenReturn(List.of());
        when(blockRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // Collects the block types the service asked to persist for a given tab.
    private List<BlockType> savedTypesForTab(BlockTab tab) {
        verify(blockRepository).saveAll(saveCaptor.capture());
        return saveCaptor.getValue().stream()
                .filter(b -> b.tab() == tab)
                .map(WeddingPageBlock::type)
                .toList();
    }

    private WeddingPageBlock existingBlock(UUID websiteId, BlockTab tab) {
        return new WeddingPageBlock(
                UUID.randomUUID(), websiteId, tab, BlockType.TEXT,
                10, "{}", LocalDateTime.now(), LocalDateTime.now());
    }

    private WeddingWebsite website(UUID websiteId) {
        return new WeddingWebsite(
                websiteId, UUID.randomUUID(), SLUG, false,
                "Grace", "James", LocalDate.of(2026, 6, 20), null,
                null, null, null, null, null,
                null, null, null, null,
                null, null, "Austin", "TX", null, null,
                null, null,
                null, null, null,
                null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                null,
                null, null, null, null, null, null, null, null, null, null,  // reception venue + titles (V90), nameFont (V91), seatingBoardTitle (V92)
                false, null, null, null
        );
    }
}
