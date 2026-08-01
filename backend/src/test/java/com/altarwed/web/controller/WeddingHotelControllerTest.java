package com.altarwed.web.controller;

import com.altarwed.application.service.WeddingHotelService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingWebsite;
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
 * Unit tests for the draft publish gate on the public hotels list endpoint
 * (issue #536). Same exposure and same gate as WeddingPartyMemberControllerTest:
 * the route is permitAll and previously served a draft's hotel names, addresses,
 * and block rates to anyone holding the websiteId.
 */
class WeddingHotelControllerTest {

    private final WeddingHotelService service = mock(WeddingHotelService.class);
    private final CoupleAccessGuard accessGuard = mock(CoupleAccessGuard.class);
    private final WeddingWebsiteService websiteService = mock(WeddingWebsiteService.class);

    private final WeddingHotelController controller =
            new WeddingHotelController(service, accessGuard, websiteService);

    private final UUID websiteId = UUID.randomUUID();
    private final UUID coupleId = UUID.randomUUID();

    @Test
    void list_draftSite_anonymousCaller_notFound() {
        when(websiteService.getByIdForVisibilityCheck(websiteId)).thenReturn(website(false));
        when(accessGuard.owns(coupleId, null)).thenReturn(false);

        assertThatThrownBy(() -> controller.list(websiteId, null))
                .isInstanceOf(WeddingWebsiteNotFoundException.class);
        verify(service, never()).listByWebsite(websiteId);
    }

    @Test
    void list_draftSite_authenticatedNonOwner_notFoundNotForbidden() {
        when(websiteService.getByIdForVisibilityCheck(websiteId)).thenReturn(website(false));
        when(accessGuard.owns(coupleId, "other@couple.test")).thenReturn(false);

        assertThatThrownBy(() -> controller.list(websiteId, "other@couple.test"))
                .isInstanceOf(WeddingWebsiteNotFoundException.class);
        verify(service, never()).listByWebsite(websiteId);
    }

    @Test
    void list_draftSite_owner_served() {
        // The dashboard's hotel manager lists a draft's hotels through this endpoint
        // with its JWT attached; the gate must not break that flow.
        when(websiteService.getByIdForVisibilityCheck(websiteId)).thenReturn(website(false));
        when(accessGuard.owns(coupleId, "owner@couple.test")).thenReturn(true);
        when(service.listByWebsite(websiteId)).thenReturn(List.of());

        assertThat(controller.list(websiteId, "owner@couple.test").getBody()).isEmpty();
    }

    @Test
    void list_publishedSite_anonymousCaller_served() {
        when(websiteService.getByIdForVisibilityCheck(websiteId)).thenReturn(website(true));
        when(service.listByWebsite(websiteId)).thenReturn(List.of());

        assertThat(controller.list(websiteId, null).getBody()).isEmpty();
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
