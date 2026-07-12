package com.altarwed.application.mapper;

import com.altarwed.application.dto.WeddingWebsiteResponse;
import com.altarwed.domain.model.WeddingWebsite;

/**
 * Canonical domain -> {@link WeddingWebsiteResponse} field mapping (issue #336).
 *
 * There is exactly ONE place that copies a {@link WeddingWebsite} into the full (owner-facing)
 * response DTO, and it lives here in the application layer next to the DTO it produces. Both call
 * sites delegate to this single function:
 *   - the web layer ({@code web.mapper.WeddingWebsiteMapper#toResponse}) for the website-detail endpoint;
 *   - the self-serve data-export path ({@code application.service.WeddingWebsiteService}) once issue
 *     #253 / PR #334 lands, replacing its hand-copied second implementation.
 *
 * Why a dependency-free static function rather than a Spring {@code @Component}: the export path lives
 * in the application layer, which must not import the web layer (the hexagonal dependency rule), so a
 * shared web mapper was never an option; a plain static utility here lets both sides call the same
 * code with zero Spring wiring and stays trivially unit-testable. Because both sides invoke the same
 * {@code new WeddingWebsiteResponse(...)} constructor, adding a field to the DTO becomes a compile
 * error here until it is mapped, which is what closes the silent-drift trap this refactor targets.
 *
 * Pure and stateless: no I/O, no logging, no PII handling (it only reshapes an in-memory record).
 */
public final class WeddingWebsiteResponseMapper {

    private WeddingWebsiteResponseMapper() {
    }

    public static WeddingWebsiteResponse toResponse(WeddingWebsite w) {
        return new WeddingWebsiteResponse(
                w.id(), w.coupleId(), w.slug(), w.isPublished(),
                w.partnerOneName(), w.partnerTwoName(), w.weddingDate(), w.engagementDate(),
                w.heroPhotoUrl(), w.heroTagline(),
                w.heroFocalPointX(), w.heroFocalPointY(), w.heroTaglineColor(),
                w.ourStory(),
                w.scriptureReference(), w.scriptureText(), w.scriptureTranslation(),
                w.venueName(), w.venueAddress(), w.venueCity(), w.venueState(),
                w.ceremonyTime(), w.dressCode(),
                w.venuePhotoUrl(), w.venueAdditionalInfo(),
                w.hotelName(), w.hotelUrl(), w.hotelDetails(),
                w.registryUrl1(), w.registryLabel1(),
                w.registryUrl2(), w.registryLabel2(),
                w.registryUrl3(), w.registryLabel3(),
                w.rsvpDeadline(),
                w.partnerOneVows(), w.partnerTwoVows(),
                w.goalBudget(),
                w.hiddenTabs(), w.customTabLabels(),
                w.accentColor(), w.scriptureBackgroundColor(),
                w.stdImageUrl(),
                w.receptionVenueName(), w.receptionVenueAddress(), w.receptionVenueCity(), w.receptionVenueState(),
                w.receptionTime(), w.receptionVenueAdditionalInfo(), w.ceremonyVenueTitle(), w.receptionVenueTitle(),
                w.nameFont(),
                w.createdAt(), w.updatedAt()
        );
    }
}
