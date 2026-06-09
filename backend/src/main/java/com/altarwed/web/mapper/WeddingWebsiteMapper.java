package com.altarwed.web.mapper;

import com.altarwed.application.dto.WeddingWebsiteResponse;
import com.altarwed.domain.model.WeddingWebsite;
import org.springframework.stereotype.Component;

@Component
public class WeddingWebsiteMapper {

    public WeddingWebsiteResponse toResponse(WeddingWebsite w) {
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
                w.createdAt(), w.updatedAt()
        );
    }
}
