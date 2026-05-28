package com.altarwed.application.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Public payload for POST /api/v1/inquiries. The endpoint is unauthenticated
 * and rate-limited at the filter level — the only protection against spam is
 * Bucket4j (per-IP) plus the Bean Validation constraints below. Keep these
 * tight: an unauthenticated POST that sends two emails per invocation is a
 * high-leverage target for abuse if we let any of these fields balloon.
 *
 * weddingDate is captured as a string rather than a LocalDate because it is
 * optional and free-form context for the vendor; pinning it to a strict
 * ISO-8601 format would reject couples who type "Summer 2026".
 */
public record SendInquiryRequest(
        @NotNull(message = "vendorId is required")
        UUID vendorId,

        @NotBlank(message = "Your name is required")
        @Size(max = 120, message = "Name must be 120 characters or fewer")
        String coupleName,

        @NotBlank(message = "Your email is required")
        @Email(message = "Must be a valid email address")
        @Size(max = 254)
        String coupleEmail,

        @Size(max = 60)
        String weddingDate,

        @NotBlank(message = "A message is required")
        @Size(min = 10, max = 2000, message = "Message must be between 10 and 2000 characters")
        String message
) {}
