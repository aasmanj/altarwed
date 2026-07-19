package com.altarwed.domain.model;

public enum PlanTier {
    BASIC, FEATURED, PREMIUM;

    /**
     * Issue #370 pricing ladder: how many portfolio photos this tier may publish. PREMIUM's
     * larger portfolio is one of its purchasable differentiators (the other is top-of-category
     * directory placement, applied in the directory query). BASIC and FEATURED keep the
     * historical cap of 10, so restoring the ladder changes nothing for existing Pro vendors.
     * Pure domain logic: the numbers live here (not in a service constant) so the cap is
     * defined once next to the tier it belongs to and the service, the DTO, and the tests all
     * read the same source of truth.
     */
    public int portfolioPhotoCap() {
        return this == PREMIUM ? 25 : 10;
    }
}
