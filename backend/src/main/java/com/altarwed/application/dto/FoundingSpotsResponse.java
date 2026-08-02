package com.altarwed.application.dto;

/**
 * Live founding-program availability for the public /for-vendors pricing page.
 * {@code remaining} is computed with the exact comparison the registration gate uses
 * (countVerified vs the configured cap), so the number a visitor sees is the decision
 * the next registration will actually make. Contains no vendor data, safe to cache
 * under the public /vendors/** Cache-Control tier.
 */
public record FoundingSpotsResponse(
        Integer cap,
        Integer remaining
) {
}
