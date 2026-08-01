package com.altarwed.web.controller;

import com.altarwed.application.dto.DraftWeddingWebsiteResponse;
import com.altarwed.application.dto.PublicWeddingWebsiteResponse;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.web.mapper.WeddingWebsiteMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the #537 slim draft-state contract on GET /slug/{slug}: a published
 * site returns the full public DTO, an existing-but-unpublished draft returns the slim
 * draft-state body (200, names + date + isPublished:false) instead of the pre-#537 404,
 * and a missing/deleted slug still 404s. The slim body is the whole point: the SEO
 * surface's Data Cache must never hold a full draft DTO, and the mapper must not even
 * run for a draft.
 */
class WeddingWebsiteControllerSlugTest {

    private final WeddingWebsiteService websiteService = mock(WeddingWebsiteService.class);
    private final WeddingWebsiteMapper mapper = mock(WeddingWebsiteMapper.class);
    private final CoupleAccessGuard accessGuard = mock(CoupleAccessGuard.class);

    private final WeddingWebsiteController controller =
            new WeddingWebsiteController(websiteService, mapper, accessGuard);

    @Test
    void getBySlug_draft_returnsSlimDraftStateBody() {
        WeddingWebsite draft = website(false);
        when(websiteService.getBySlugForPreview("draft-slug")).thenReturn(draft);

        Object body = controller.getBySlug("draft-slug").getBody();

        assertThat(body).isInstanceOf(DraftWeddingWebsiteResponse.class);
        DraftWeddingWebsiteResponse slim = (DraftWeddingWebsiteResponse) body;
        assertThat(slim.slug()).isEqualTo("some-slug");
        assertThat(slim.partnerOneName()).isEqualTo("Partner One");
        assertThat(slim.partnerTwoName()).isEqualTo("Partner Two");
        assertThat(slim.weddingDate()).isEqualTo(LocalDate.of(2026, 6, 20));
        assertThat(slim.isPublished()).isFalse();
        // The full draft DTO must never be produced on this path.
        verify(mapper, never()).toPublicResponse(draft);
    }

    @Test
    void getBySlug_published_returnsFullPublicDto() {
        WeddingWebsite published = website(true);
        PublicWeddingWebsiteResponse full = mock(PublicWeddingWebsiteResponse.class);
        when(websiteService.getBySlugForPreview("live-slug")).thenReturn(published);
        when(mapper.toPublicResponse(published)).thenReturn(full);

        assertThat(controller.getBySlug("live-slug").getBody()).isSameAs(full);
    }

    @Test
    void getBySlug_missingOrDeleted_stillNotFound() {
        when(websiteService.getBySlugForPreview("gone"))
                .thenThrow(new WeddingWebsiteNotFoundException("gone"));

        assertThatThrownBy(() -> controller.getBySlug("gone"))
                .isInstanceOf(WeddingWebsiteNotFoundException.class);
    }

    @Test
    void getBySlugForPreview_draft_stillServedForComingSoonFallbackAndEditorIframe() {
        // The frontend keeps probeUnpublished as a deploy-skew fallback and the editor
        // preview iframe depends on this route; both need drafts served here.
        WeddingWebsite draft = website(false);
        PublicWeddingWebsiteResponse full = mock(PublicWeddingWebsiteResponse.class);
        when(websiteService.getBySlugForPreview("draft-slug")).thenReturn(draft);
        when(mapper.toPublicResponse(draft)).thenReturn(full);

        assertThat(controller.getBySlugForPreview("draft-slug").getBody()).isSameAs(full);
    }

    // Positional constructor mirrors websiteWithFlags in WeddingWebsiteServiceTest.
    private WeddingWebsite website(boolean published) {
        return new WeddingWebsite(
                UUID.randomUUID(), UUID.randomUUID(), "some-slug", published,
                "Partner One", "Partner Two", LocalDate.of(2026, 6, 20), null,
                null, null, null, null, null,
                null, null, null, null,
                null, null, "Austin", "TX", null, null,
                null, null,
                null, null, null,
                null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                null,
                null, null, null, null, null, null, null, null, null, null,
                null, null,
                false, null, null, null
        );
    }
}
