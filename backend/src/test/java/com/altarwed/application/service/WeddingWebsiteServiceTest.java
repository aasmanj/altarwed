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
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
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
