package com.altarwed.web.mapper;

import com.altarwed.application.dto.PublicWeddingWebsiteResponse;
import com.altarwed.application.dto.WeddingWebsiteResponse;
import com.altarwed.application.mapper.WeddingWebsiteResponseMapper;
import com.altarwed.domain.model.WeddingWebsite;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WeddingWebsiteMapperTest {

    private final WeddingWebsiteMapper mapper = new WeddingWebsiteMapper();
    // Mirrors JacksonConfig's bean so this test proves the actual bytes an anonymous
    // client receives, not just that two Java record types are unrelated.
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private WeddingWebsite website() {
        return new WeddingWebsite(
                UUID.randomUUID(), UUID.randomUUID(), "jordan-and-jane", true,
                "Jordan", "Jane", LocalDate.of(2027, 6, 12), LocalDate.of(2026, 1, 1),
                "https://cdn/hero.jpg", "Forever begins here", 0.5, 0.5, "#ffffff",
                "Our story", "John 3:16", "For God so loved the world", "ESV",
                "Grace Church", "123 Main St", "Austin", "TX", "4:00 PM", "Formal",
                "https://cdn/venue.jpg", "Parking in the north lot",
                "Hilton Austin", "https://hilton.com", "Group rate ABC123",
                "https://registry1.com", "Target", "https://registry2.com", "Amazon", null, null,
                LocalDate.of(2027, 5, 1),
                "I do", "I do too",
                new BigDecimal("25000.00"),
                "REGISTRY", "{}",
                "#d4af6a", "#1a1a2e",
                "https://cdn/std.jpg",
                "The Grand Hall", "500 River Rd", "Round Rock", "TX", "6:00 PM", "Dinner and dancing to follow",
                "The Ceremony", "The Reception",
                "cinzel", "Our Day",
                40, "framed",
                false, null,
                LocalDateTime.of(2026, 1, 1, 0, 0), LocalDateTime.of(2026, 1, 2, 0, 0)
        );
    }

    @Test
    void toResponseIncludesCoupleIdAndGoalBudget() {
        WeddingWebsite w = website();

        WeddingWebsiteResponse response = mapper.toResponse(w);

        assertThat(response.coupleId()).isEqualTo(w.coupleId());
        assertThat(response.goalBudget()).isEqualByComparingTo(w.goalBudget());
    }

    @Test
    void toResponseDelegatesToTheCanonicalMapping() {
        WeddingWebsite w = website();

        // Issue #336: the web endpoint's mapper must produce field-for-field identical output to the
        // single canonical mapping in the application layer, proving the delegation changed nothing.
        WeddingWebsiteResponse viaWebMapper = mapper.toResponse(w);
        WeddingWebsiteResponse viaCanonical = WeddingWebsiteResponseMapper.toResponse(w);

        assertThat(viaWebMapper).isEqualTo(viaCanonical);
    }

    @Test
    void toPublicResponseOmitsCoupleIdAndGoalBudgetFromTheWireFormat() throws Exception {
        WeddingWebsite w = website();

        PublicWeddingWebsiteResponse response = mapper.toPublicResponse(w);
        Map<String, Object> json = objectMapper.readValue(
                objectMapper.writeValueAsString(response), new TypeReference<Map<String, Object>>() {});

        assertThat(json).doesNotContainKeys("coupleId", "goalBudget");
    }

    @Test
    void toPublicResponsePreservesPublicFields() {
        WeddingWebsite w = website();

        PublicWeddingWebsiteResponse response = mapper.toPublicResponse(w);

        assertThat(response.id()).isEqualTo(w.id());
        assertThat(response.slug()).isEqualTo(w.slug());
        assertThat(response.isPublished()).isEqualTo(w.isPublished());
        assertThat(response.partnerOneName()).isEqualTo(w.partnerOneName());
        assertThat(response.partnerTwoName()).isEqualTo(w.partnerTwoName());
        assertThat(response.weddingDate()).isEqualTo(w.weddingDate());
        assertThat(response.venueName()).isEqualTo(w.venueName());
        assertThat(response.registryUrl1()).isEqualTo(w.registryUrl1());
        // V90/V91: reception venue + titles + name font must survive the public mapping too.
        // (Guards a transposition in toPublicResponse, which is not reflection-checked.)
        assertThat(response.receptionVenueName()).isEqualTo(w.receptionVenueName());
        assertThat(response.receptionVenueAddress()).isEqualTo(w.receptionVenueAddress());
        assertThat(response.receptionVenueCity()).isEqualTo(w.receptionVenueCity());
        assertThat(response.receptionVenueState()).isEqualTo(w.receptionVenueState());
        assertThat(response.receptionTime()).isEqualTo(w.receptionTime());
        assertThat(response.receptionVenueAdditionalInfo()).isEqualTo(w.receptionVenueAdditionalInfo());
        assertThat(response.ceremonyVenueTitle()).isEqualTo(w.ceremonyVenueTitle());
        assertThat(response.receptionVenueTitle()).isEqualTo(w.receptionVenueTitle());
        assertThat(response.nameFont()).isEqualTo(w.nameFont());
        // V96: hero presentation controls must survive the public mapping too.
        assertThat(response.heroOverlayDarkness()).isEqualTo(w.heroOverlayDarkness());
        assertThat(response.heroLayout()).isEqualTo(w.heroLayout());
        assertThat(response.createdAt()).isEqualTo(w.createdAt());
        assertThat(response.updatedAt()).isEqualTo(w.updatedAt());
    }
}
