package com.altarwed.application.service;

import com.altarwed.application.dto.UpdateWeddingWebsiteRequest;
import com.altarwed.application.dto.WeddingWebsiteSearchResultResponse;
import com.altarwed.domain.exception.WeddingWebsiteNotFoundException;
import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.model.WeddingWebsiteSummary;
import com.altarwed.domain.port.ConversionEventPort;
import com.altarwed.domain.port.CoupleRepository;
import com.altarwed.domain.port.RevalidationPort;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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
    void getPublishedPage_withinBounds_delegatesUnchanged() {
        // Issue #241: a normal request passes page/size straight through to the repository so the
        // sitemap loader gets exactly the page it asked for.
        when(websiteRepository.findPublishedSummaries(2, 500)).thenReturn(summaries(3));

        List<WeddingWebsiteSummary> page = weddingWebsiteService.getPublishedPage(2, 500);

        assertThat(page).hasSize(3);
        verify(websiteRepository).findPublishedSummaries(2, 500);
    }

    @Test
    void getPublishedPage_oversizeRequest_isClampedToCeiling() {
        // The endpoint is unauthenticated, so a caller must not be able to request an arbitrarily
        // large page and stream the whole published-sites table in one query.
        weddingWebsiteService.getPublishedPage(0, 100_000);

        verify(websiteRepository)
                .findPublishedSummaries(0, WeddingWebsiteService.MAX_SITEMAP_PAGE_SIZE);
    }

    @Test
    void getPublishedPage_negativePageAndZeroSize_areClampedToSafeFloor() {
        // A hostile or buggy caller cannot force a negative page or a zero/negative size; both are
        // clamped to their safe floor (page 0, size 1) before the query runs.
        weddingWebsiteService.getPublishedPage(-4, 0);

        verify(websiteRepository).findPublishedSummaries(0, 1);
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

    @Test
    void getBySlug_unpublishedSite_throwsNotFound() {
        // #91: the public path (SSR /wedding/[slug]) must 404 a draft site the same as a
        // deleted one, or a guessable low-entropy slug leaks a couple's unpublished content.
        WeddingWebsite draft = websiteWithFlags(false, false);
        when(websiteRepository.findBySlug("draft-couple")).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> weddingWebsiteService.getBySlug("draft-couple"))
                .isInstanceOf(WeddingWebsiteNotFoundException.class);
    }

    @Test
    void getBySlug_publishedSite_returnsIt() {
        WeddingWebsite published = websiteWithFlags(true, false);
        when(websiteRepository.findBySlug("live-couple")).thenReturn(Optional.of(published));

        assertThat(weddingWebsiteService.getBySlug("live-couple")).isEqualTo(published);
    }

    @Test
    void getBySlugForPreview_unpublishedSite_stillReturnsIt() {
        // The owner-only editor preview must keep rendering drafts; this is what the
        // /preview/[slug]/[tab] route uses instead of the now-gated getBySlug.
        WeddingWebsite draft = websiteWithFlags(false, false);
        when(websiteRepository.findBySlug("draft-couple")).thenReturn(Optional.of(draft));

        assertThat(weddingWebsiteService.getBySlugForPreview("draft-couple")).isEqualTo(draft);
    }

    @Test
    void getBySlugForPreview_deletedSite_throwsNotFound() {
        WeddingWebsite deleted = websiteWithFlags(false, true);
        when(websiteRepository.findBySlug("deleted-couple")).thenReturn(Optional.of(deleted));

        assertThatThrownBy(() -> weddingWebsiteService.getBySlugForPreview("deleted-couple"))
                .isInstanceOf(WeddingWebsiteNotFoundException.class);
    }

    @Test
    void blankToNull_clearableMerge_appliesValue_clearsBlank_keepsExistingOnNull() {
        // The clearable-field merge used for the reception venue + card titles (V90). Bug guard:
        // a blank must clear (null out) so a couple can REMOVE a reception venue they changed,
        // while a null request value leaves the existing value untouched (patch semantics).
        assertThat(WeddingWebsiteService.blankToNull(null, "existing")).isEqualTo("existing"); // omitted -> no change
        assertThat(WeddingWebsiteService.blankToNull("", "existing")).isNull();                // cleared
        assertThat(WeddingWebsiteService.blankToNull("   ", "existing")).isNull();             // whitespace -> cleared
        assertThat(WeddingWebsiteService.blankToNull("The Grand Hall", "existing")).isEqualTo("The Grand Hall"); // applied
        assertThat(WeddingWebsiteService.blankToNull("New", null)).isEqualTo("New");           // applied over null existing
    }

    @Test
    void update_seatingBoardTitle_isApplied_clearedByBlank_keptOnNull() {
        // V92: seatingBoardTitle uses blankToNull semantics (same as ceremonyVenueTitle).
        // A non-null value is applied, blank clears to null (board reverts to "Welcome"),
        // and null means "field omitted, keep existing."
        UUID coupleId = UUID.randomUUID();
        WeddingWebsite existing = websiteWithFlags(false, false);
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.of(existing));
        when(websiteRepository.save(ArgumentMatchers.any())).thenAnswer(inv -> inv.getArgument(0));

        // apply a new title
        WeddingWebsite applied = weddingWebsiteService.update(coupleId, titleRequest("Our Wedding"));
        assertThat(applied.seatingBoardTitle()).isEqualTo("Our Wedding");

        // blank clears to null
        WeddingWebsite cleared = weddingWebsiteService.update(coupleId, titleRequest(""));
        assertThat(cleared.seatingBoardTitle()).isNull();

        // null keeps the existing value (null in this case)
        WeddingWebsite kept = weddingWebsiteService.update(coupleId, titleRequest(null));
        assertThat(kept.seatingBoardTitle()).isEqualTo(existing.seatingBoardTitle());
    }

    @Test
    void update_heroOverlayAndLayout_appliedWhenSet_keptOnNull() {
        // V96 (issue #360): heroOverlayDarkness and heroLayout are plain patch-merge fields.
        // A non-null value is applied; a null leaves the existing value untouched. The
        // @Min/@Max and @Pattern on the request already clamp/allowlist the values, so the
        // service persists them verbatim.
        UUID coupleId = UUID.randomUUID();
        WeddingWebsite existing = websiteWithFlags(false, false);
        when(websiteRepository.findByCoupleId(coupleId)).thenReturn(Optional.of(existing));
        when(websiteRepository.save(ArgumentMatchers.any())).thenAnswer(inv -> inv.getArgument(0));

        // both applied when provided
        WeddingWebsite applied = weddingWebsiteService.update(coupleId, heroRequest(30, "framed"));
        assertThat(applied.heroOverlayDarkness()).isEqualTo(30);
        assertThat(applied.heroLayout()).isEqualTo("framed");

        // null keeps existing (null on a fresh site => defaults still apply at render time)
        WeddingWebsite kept = weddingWebsiteService.update(coupleId, heroRequest(null, null));
        assertThat(kept.heroOverlayDarkness()).isEqualTo(existing.heroOverlayDarkness());
        assertThat(kept.heroLayout()).isEqualTo(existing.heroLayout());
    }

    // Builds an UpdateWeddingWebsiteRequest with only the two V96 hero fields set; all others
    // are null so they are omitted from the patch.
    private static UpdateWeddingWebsiteRequest heroRequest(Integer heroOverlayDarkness, String heroLayout) {
        return new UpdateWeddingWebsiteRequest(
                null, null, null, null,
                null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null,
                null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                null, null, null, null, null, null, null, null, null,
                null, null,
                null,
                heroOverlayDarkness, heroLayout
        );
    }

    // Builds an UpdateWeddingWebsiteRequest with only seatingBoardTitle set; all other
    // fields are null so they are omitted from the patch.
    // Field order mirrors UpdateWeddingWebsiteRequest (50 params total):
    //   1-4:  partnerOneName, partnerTwoName, weddingDate, engagementDate
    //   5-9:  heroPhotoUrl, heroTagline, heroFocalPointX, heroFocalPointY, heroTaglineColor
    //   10-19: ourStory, scriptureRef, scriptureText, scriptureTranslation, venueName,
    //          venueAddress, venueCity, venueState, ceremonyTime, dressCode
    //   20-22: venuePhotoUrl, venueAdditionalInfo, hotelName
    //   23-28: hotelUrl, hotelDetails, registryUrl1-3 + labels1-2
    //   29-32: registryUrl3, registryLabel3, rsvpDeadline, partnerOneVows
    //   33-36: partnerTwoVows, goalBudget, hiddenTabs, customTabLabels
    //   37-45: accentColor, scriptureBackgroundColor, receptionVenueName-state, receptionTime,
    //          receptionVenueAdditionalInfo, ceremonyVenueTitle
    //   46-47: receptionVenueTitle, nameFont
    //   48:    seatingBoardTitle
    //   49-50: heroOverlayDarkness, heroLayout (V96)
    private static UpdateWeddingWebsiteRequest titleRequest(String seatingBoardTitle) {
        return new UpdateWeddingWebsiteRequest(
                null, null, null, null,
                null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null,
                null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                null, null, null, null, null, null, null, null, null,
                null, null,
                seatingBoardTitle,
                null, null  // heroOverlayDarkness, heroLayout (V96)
        );
    }

    private WeddingWebsite websiteWithFlags(boolean published, boolean deleted) {
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
                null, null, null, null, null, null, null, null, null, null,  // reception venue + titles (V90), nameFont (V91), seatingBoardTitle (V92)
                null, null,  // heroOverlayDarkness, heroLayout (V96)
                deleted, null, null, null
        );
    }

    private List<WeddingWebsiteSummary> summaries(int count) {
        List<WeddingWebsiteSummary> result = new ArrayList<>(count);
        IntStream.range(0, count).forEach(i ->
                result.add(new WeddingWebsiteSummary("couple-" + i, java.time.LocalDateTime.now())));
        return result;
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
                null, null, null, null, null, null, null, null, null, null,  // reception venue + titles (V90), nameFont (V91), seatingBoardTitle (V92)
                null, null,  // heroOverlayDarkness, heroLayout (V96)
                false, null, null, null
        );
    }
}
