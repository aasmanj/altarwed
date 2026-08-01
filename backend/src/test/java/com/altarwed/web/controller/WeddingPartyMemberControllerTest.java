package com.altarwed.web.controller;

import com.altarwed.application.service.WeddingPartyMemberService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.web.mapper.WeddingPartyMemberMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the draft publish gate on the public wedding-party list endpoint
 * (issue #536). The route is permitAll, so before this gate an anonymous caller who
 * learned a draft's websiteId (leaked via the /preview wedding DTO) could read the
 * full party list pre-publish. Controllers are plain classes, so this is a
 * Mockito-only unit test (no Spring context), matching MediaUploadControllerTest.
 */
class WeddingPartyMemberControllerTest {

    private final WeddingPartyMemberService service = mock(WeddingPartyMemberService.class);
    private final WeddingPartyMemberMapper mapper = mock(WeddingPartyMemberMapper.class);
    private final CoupleAccessGuard accessGuard = mock(CoupleAccessGuard.class);
    private final WeddingWebsiteService websiteService = mock(WeddingWebsiteService.class);

    private final WeddingPartyMemberController controller =
            new WeddingPartyMemberController(service, mapper, accessGuard, websiteService);

    private final UUID websiteId = UUID.randomUUID();
    private final UUID coupleId = UUID.randomUUID();

    @Test
    void list_draftSite_anonymousCaller_notFound() {
        when(websiteService.getByIdForVisibilityCheck(websiteId)).thenReturn(website(false));
        when(accessGuard.owns(coupleId, null)).thenReturn(false);

        assertThatThrownBy(() -> controller.list(websiteId, null))
                .isInstanceOf(WeddingWebsiteNotFoundException.class);
        verify(service, never()).listMembers(websiteId);
    }

    @Test
    void list_draftSite_authenticatedNonOwner_notFoundNotForbidden() {
        // 404, not 403: a 403 would confirm to a prober that the draft exists.
        when(websiteService.getByIdForVisibilityCheck(websiteId)).thenReturn(website(false));
        when(accessGuard.owns(coupleId, "other@couple.test")).thenReturn(false);

        assertThatThrownBy(() -> controller.list(websiteId, "other@couple.test"))
                .isInstanceOf(WeddingWebsiteNotFoundException.class);
        verify(service, never()).listMembers(websiteId);
    }

    @Test
    void list_draftSite_owner_served() {
        // The dashboard lists party members for drafts through this same endpoint,
        // with its JWT attached; the gate must not break that flow.
        when(websiteService.getByIdForVisibilityCheck(websiteId)).thenReturn(website(false));
        when(accessGuard.owns(coupleId, "owner@couple.test")).thenReturn(true);
        when(service.listMembers(websiteId)).thenReturn(List.of());

        assertThat(controller.list(websiteId, "owner@couple.test").getBody()).isEmpty();
    }

    @Test
    void list_publishedSite_anonymousCaller_served() {
        when(websiteService.getByIdForVisibilityCheck(websiteId)).thenReturn(website(true));
        when(service.listMembers(websiteId)).thenReturn(List.of());

        assertThat(controller.list(websiteId, null).getBody()).isEmpty();
    }

    @Test
    void listForPreview_draftSite_servedBySlug() {
        // The editor preview iframe cannot attach a JWT across origins; the slug is
        // the capability (same model as photos, #91), so drafts must stay reachable.
        when(websiteService.getBySlugForPreview("draft-slug")).thenReturn(website(false));
        when(service.listMembers(websiteId)).thenReturn(List.of());

        assertThat(controller.listForPreview("draft-slug").getBody()).isEmpty();
    }

    // Positional constructor mirrors websiteWithFlags in WeddingWebsiteServiceTest.
    private WeddingWebsite website(boolean published) {
        return new WeddingWebsite(
                websiteId, coupleId, "some-slug", published,
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
