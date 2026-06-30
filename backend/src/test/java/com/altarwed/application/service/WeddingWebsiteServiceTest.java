package com.altarwed.application.service;

import com.altarwed.application.dto.WeddingWebsiteSearchResultResponse;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.ConversionEventPort;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.RevalidationPort;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link WeddingWebsiteService#search}, focused on the public,
 * unauthenticated result-set cap. A blank-filter request must never stream the
 * whole published-sites table (egress / DoS vector), so the service trims to
 * {@link WeddingWebsiteRepository#MAX_SEARCH_RESULTS} regardless of filters.
 */
@ExtendWith(MockitoExtension.class)
class WeddingWebsiteServiceTest {

    @Mock private WeddingWebsiteRepository websiteRepository;
    @Mock private RevalidationPort revalidationPort;
    @Mock private CoupleRepository coupleRepository;
    @Mock private ConversionEventPort conversionEventPort;
    @Mock private AsyncEmailService asyncEmailService;

    @InjectMocks private WeddingWebsiteService weddingWebsiteService;

    @Test
    void search_blankFilter_capsResultsAtMaxSearchResults() {
        // Simulate a repository that has not (yet) capped: the service must still
        // never expose more than the cap to an unauthenticated blank-filter request.
        when(websiteRepository.searchPublishedByNameAndYear(null, null))
                .thenReturn(publishedSites(WeddingWebsiteRepository.MAX_SEARCH_RESULTS + 75));

        List<WeddingWebsiteSearchResultResponse> results = weddingWebsiteService.search(null, null);

        assertThat(results).hasSize(WeddingWebsiteRepository.MAX_SEARCH_RESULTS);
    }

    @Test
    void search_blankName_isNormalisedToNullAndStillCapped() {
        // A whitespace-only name is treated as no filter; the cap must still apply.
        when(websiteRepository.searchPublishedByNameAndYear(null, 2026))
                .thenReturn(publishedSites(WeddingWebsiteRepository.MAX_SEARCH_RESULTS + 1));

        List<WeddingWebsiteSearchResultResponse> results = weddingWebsiteService.search("   ", 2026);

        assertThat(results).hasSize(WeddingWebsiteRepository.MAX_SEARCH_RESULTS);
    }

    @Test
    void search_belowCap_returnsEveryMatchMapped() {
        when(websiteRepository.searchPublishedByNameAndYear("smith", null))
                .thenReturn(publishedSites(3));

        List<WeddingWebsiteSearchResultResponse> results = weddingWebsiteService.search("smith", null);

        assertThat(results).hasSize(3);
        assertThat(results.get(0).slug()).isNotBlank();
    }

    @Test
    void currentBlobUrlGetters_returnTheMatchingField_whenWebsitePresent() {
        // These reads back the controller's orphan-blob cleanup on replace/remove (issue #101): each
        // getter must return the URL of its own field so the right old blob is deleted.
        UUID websiteId = UUID.randomUUID();
        WeddingWebsite website = mock(WeddingWebsite.class);
        when(website.heroPhotoUrl()).thenReturn("https://blob/hero.png");
        when(website.venuePhotoUrl()).thenReturn("https://blob/venue.png");
        when(website.stdImageUrl()).thenReturn("https://blob/std.png");
        when(websiteRepository.findById(websiteId)).thenReturn(Optional.of(website));

        assertThat(weddingWebsiteService.currentHeroPhotoUrl(websiteId)).isEqualTo("https://blob/hero.png");
        assertThat(weddingWebsiteService.currentVenuePhotoUrl(websiteId)).isEqualTo("https://blob/venue.png");
        assertThat(weddingWebsiteService.currentStdImageUrl(websiteId)).isEqualTo("https://blob/std.png");
    }

    @Test
    void currentHeroPhotoUrl_returnsNull_whenWebsiteAbsent() {
        // A missing website yields null, which deleteBlobBestEffort treats as a no-op (no NPE, no throw).
        UUID websiteId = UUID.randomUUID();
        when(websiteRepository.findById(websiteId)).thenReturn(Optional.empty());

        assertThat(weddingWebsiteService.currentHeroPhotoUrl(websiteId)).isNull();
    }

    private List<WeddingWebsite> publishedSites(int count) {
        List<WeddingWebsite> sites = new ArrayList<>(count);
        IntStream.range(0, count).forEach(i -> sites.add(publishedSite(i)));
        return sites;
    }

    private WeddingWebsite publishedSite(int i) {
        return new WeddingWebsite(
                UUID.randomUUID(), UUID.randomUUID(), "couple-" + i, true,
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
                false, null, null, null
        );
    }
}
