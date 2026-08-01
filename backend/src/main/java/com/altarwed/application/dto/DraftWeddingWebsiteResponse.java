package com.altarwed.application.dto;

import com.altarwed.domain.model.WeddingWebsite;

import java.time.LocalDate;

/**
 * Slim draft-state body for {@code GET /wedding-websites/slug/{slug}} when the site
 * exists but is unpublished (issue #537). Carries exactly what the public ComingSoon
 * page renders (names + date) plus the {@code isPublished} discriminator the frontend
 * keys off. The full public DTO must never leave the server for a draft on the SEO
 * surface: Next's Data Cache stores /slug responses for 60s, and the pre-#537 design
 * pulled the entire draft DTO through the /preview probe to work around the 404.
 */
public record DraftWeddingWebsiteResponse(
        String slug,
        String partnerOneName,
        String partnerTwoName,
        LocalDate weddingDate,
        Boolean isPublished
) {
    public static DraftWeddingWebsiteResponse of(WeddingWebsite website) {
        return new DraftWeddingWebsiteResponse(
                website.slug(),
                website.partnerOneName(),
                website.partnerTwoName(),
                website.weddingDate(),
                Boolean.FALSE
        );
    }
}
