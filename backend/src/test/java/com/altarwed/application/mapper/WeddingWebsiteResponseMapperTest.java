package com.altarwed.application.mapper;

import com.altarwed.application.dto.WeddingWebsiteResponse;
import com.altarwed.domain.model.WeddingWebsite;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for the canonical domain -> {@link WeddingWebsiteResponse} mapping (issue #336).
 *
 * The load-bearing guarantee is drift protection. Before this refactor there were two hand-copied
 * implementations of this mapping (the web mapper and the export path in WeddingWebsiteService), and
 * a new field could be added to the DTO and the web mapper while the export silently dropped it, with
 * CI green. Now there is one function, and this reflection-driven test walks EVERY component of
 * {@link WeddingWebsiteResponse}: if a field is added to the DTO but not populated from the matching
 * domain field, the mapper stops compiling or this test fails. It is the automated backstop for the
 * "one source of truth" acceptance criterion.
 */
class WeddingWebsiteResponseMapperTest {

    // Every field distinct and non-null so a mis-wired (transposed) or unpopulated field is caught.
    private WeddingWebsite fullyPopulatedWebsite() {
        return new WeddingWebsite(
                UUID.randomUUID(), UUID.randomUUID(), "jordan-and-jane", true,
                "Jordan", "Jane", LocalDate.of(2027, 6, 12), LocalDate.of(2026, 1, 1),
                "https://cdn/hero.jpg", "Forever begins here", 0.25, 0.75, "#ffffff",
                "Our story", "John 3:16", "For God so loved the world", "ESV",
                "Grace Church", "123 Main St", "Austin", "TX", "4:00 PM", "Formal",
                "https://cdn/venue.jpg", "Parking in the north lot",
                "Hilton Austin", "https://hilton.com", "Group rate ABC123",
                "https://registry1.com", "Target",
                "https://registry2.com", "Amazon",
                "https://registry3.com", "Crate & Barrel",
                LocalDate.of(2027, 5, 1),
                "I do", "I do too",
                new BigDecimal("25000.00"),
                "REGISTRY,TRAVEL", "{\"TRAVEL\":\"Hotels\"}",
                "#d4af6a", "#1a1a2e",
                "https://cdn/std.jpg",
                false, null,
                LocalDateTime.of(2026, 1, 1, 0, 0), LocalDateTime.of(2026, 1, 2, 0, 0)
        );
    }

    @Test
    void toResponseMapsEveryDtoFieldFromTheSameNamedDomainField() throws Exception {
        WeddingWebsite w = fullyPopulatedWebsite();

        WeddingWebsiteResponse response = WeddingWebsiteResponseMapper.toResponse(w);

        // Walk every DTO component. For each, find the same-named accessor on the domain record and
        // assert the mapper copied that exact value. A newly added DTO field with no matching domain
        // accessor throws NoSuchMethodException here; an unmapped/transposed field fails the equality
        // check. Either way, drift cannot slip through green CI.
        for (RecordComponent rc : WeddingWebsiteResponse.class.getRecordComponents()) {
            String field = rc.getName();
            Object mappedValue = rc.getAccessor().invoke(response);
            Object domainValue = WeddingWebsite.class.getMethod(field).invoke(w);

            assertThat(mappedValue)
                    .as("WeddingWebsiteResponse.%s must be populated by the canonical mapper", field)
                    .isNotNull();
            assertThat(mappedValue)
                    .as("WeddingWebsiteResponse.%s must equal WeddingWebsite.%s", field, field)
                    .isEqualTo(domainValue);
        }
    }
}
