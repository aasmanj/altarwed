package com.altarwed.application.dto;

/**
 * Live founding-program availability for the public /for-vendors pricing page.
 * {@code remaining} is computed from the same founding_program.slots_claimed counter the
 * registration gate consumes (issue #554), so the number a visitor sees is the decision
 * the next registration will actually make. Contains no vendor data, safe to cache
 * under the public /vendors/** Cache-Control tier.
 */
public record FoundingSpotsResponse(
        Integer cap,
        Integer remaining
) {
}
