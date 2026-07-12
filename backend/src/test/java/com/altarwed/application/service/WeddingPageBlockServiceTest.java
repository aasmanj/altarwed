package com.altarwed.application.service;

import com.altarwed.application.dto.CreateWeddingPageBlockRequest;
import com.altarwed.application.dto.ReorderBlocksRequest;
import com.altarwed.application.dto.UpdateWeddingPageBlockRequest;
import com.altarwed.domain.model.BlockTab;
import com.altarwed.domain.model.BlockType;
import com.altarwed.domain.model.WeddingPageBlock;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.RevalidationPort;
import com.altarwed.domain.port.WeddingPageBlockRepository;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link WeddingPageBlockService} ISR revalidation behaviour (#234).
 *
 * The flagship page-builder mutations (create/update/delete/reorder) must trigger a
 * Next.js ISR revalidation for the owning wedding page so a couple's edit shows on the
 * live site immediately rather than after the 60s ISR window. Revalidation must fire ONLY
 * for a published site: a draft has no live public route in the ISR cache, so revalidating
 * its slug is a pointless request and log-noise on every pre-launch edit.
 */
@ExtendWith(MockitoExtension.class)
class WeddingPageBlockServiceTest {

    @Mock private WeddingPageBlockRepository blockRepository;
    @Mock private WeddingWebsiteRepository websiteRepository;
    @Mock private RevalidationPort revalidationPort;

    @InjectMocks private WeddingPageBlockService service;

    private static final String SLUG = "grace-and-james";

    // ----- published site: each mutation revalidates the owning page -----

    @Test
    void create_publishedSite_revalidatesOwningPage() {
        UUID websiteId = UUID.randomUUID();
        stubWebsite(websiteId, true);
        when(blockRepository.findMaxSortOrderByWebsiteIdAndTab(websiteId, BlockTab.HOME)).thenReturn(10);
        when(blockRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.create(websiteId, new CreateWeddingPageBlockRequest(BlockTab.HOME, BlockType.TEXT, "{}"));

        verify(revalidationPort, times(1)).revalidateWeddingPage(SLUG);
    }

    @Test
    void update_publishedSite_revalidatesOwningPage() {
        UUID websiteId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        stubWebsite(websiteId, true);
        WeddingPageBlock existing = block(blockId, websiteId);
        when(blockRepository.findById(blockId)).thenReturn(Optional.of(existing));
        when(blockRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(websiteId, blockId, new UpdateWeddingPageBlockRequest("{\"text\":\"hi\"}"));

        verify(revalidationPort, times(1)).revalidateWeddingPage(SLUG);
    }

    @Test
    void delete_publishedSite_revalidatesOwningPage() {
        UUID websiteId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        stubWebsite(websiteId, true);
        when(blockRepository.findById(blockId)).thenReturn(Optional.of(block(blockId, websiteId)));

        service.delete(websiteId, blockId);

        verify(revalidationPort, times(1)).revalidateWeddingPage(SLUG);
    }

    @Test
    void reorder_publishedSite_revalidatesOwningPage() {
        UUID websiteId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        stubWebsite(websiteId, true);
        when(blockRepository.findAllByWebsiteIdAndTab(websiteId, BlockTab.HOME))
                .thenReturn(List.of(block(blockId, websiteId)));
        when(blockRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        service.reorder(websiteId, BlockTab.HOME, new ReorderBlocksRequest(List.of(blockId)));

        verify(revalidationPort, times(1)).revalidateWeddingPage(SLUG);
    }

    // ----- draft site: no mutation revalidates -----

    @Test
    void create_draftSite_doesNotRevalidate() {
        UUID websiteId = UUID.randomUUID();
        stubWebsite(websiteId, false);
        when(blockRepository.findMaxSortOrderByWebsiteIdAndTab(websiteId, BlockTab.HOME)).thenReturn(0);
        when(blockRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.create(websiteId, new CreateWeddingPageBlockRequest(BlockTab.HOME, BlockType.TEXT, "{}"));

        verify(revalidationPort, never()).revalidateWeddingPage(any());
    }

    @Test
    void update_draftSite_doesNotRevalidate() {
        UUID websiteId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        stubWebsite(websiteId, false);
        when(blockRepository.findById(blockId)).thenReturn(Optional.of(block(blockId, websiteId)));
        when(blockRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(websiteId, blockId, new UpdateWeddingPageBlockRequest("{\"text\":\"hi\"}"));

        verify(revalidationPort, never()).revalidateWeddingPage(any());
    }

    @Test
    void delete_draftSite_doesNotRevalidate() {
        UUID websiteId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        stubWebsite(websiteId, false);
        when(blockRepository.findById(blockId)).thenReturn(Optional.of(block(blockId, websiteId)));

        service.delete(websiteId, blockId);

        verify(revalidationPort, never()).revalidateWeddingPage(any());
    }

    @Test
    void reorder_draftSite_doesNotRevalidate() {
        UUID websiteId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        stubWebsite(websiteId, false);
        when(blockRepository.findAllByWebsiteIdAndTab(websiteId, BlockTab.HOME))
                .thenReturn(List.of(block(blockId, websiteId)));
        when(blockRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        service.reorder(websiteId, BlockTab.HOME, new ReorderBlocksRequest(List.of(blockId)));

        verify(revalidationPort, never()).revalidateWeddingPage(any());
    }

    // ----- helpers -----

    private void stubWebsite(UUID websiteId, boolean published) {
        when(websiteRepository.findById(websiteId)).thenReturn(Optional.of(website(websiteId, published)));
    }

    private WeddingPageBlock block(UUID blockId, UUID websiteId) {
        return new WeddingPageBlock(
                blockId, websiteId, BlockTab.HOME, BlockType.TEXT,
                10, "{}", LocalDateTime.now(), LocalDateTime.now());
    }

    private WeddingWebsite website(UUID websiteId, boolean published) {
        return new WeddingWebsite(
                websiteId, UUID.randomUUID(), SLUG, published,
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
                null, null, null, null, null, null, null, null, null,  // reception venue + titles (V90), nameFont (V91)
                false, null, null, null
        );
    }
}
