package com.altarwed.application.dto;

import jakarta.validation.constraints.Size;

/**
 * Optional marketing attribution sent by the signup form alongside the couple's
 * details. Every field is optional and length-capped at the DB column width; the
 * service normalises blanks to null. Mirrors {@code AcquisitionSource} in the
 * domain, but lives here because it is a wire DTO with Bean Validation, not a
 * domain value object.
 */
public record AcquisitionInfo(
        @Size(max = 255) String utmSource,
        @Size(max = 255) String utmMedium,
        @Size(max = 255) String utmCampaign,
        @Size(max = 255) String utmTerm,
        @Size(max = 255) String utmContent,
        @Size(max = 255) String referrer,
        @Size(max = 255) String landingPath
) {}
