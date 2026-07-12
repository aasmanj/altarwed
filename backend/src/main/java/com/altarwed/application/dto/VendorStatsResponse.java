package com.altarwed.application.dto;

/**
 * Free-tier vendor stats, returned by GET /api/v1/vendors/me/stats to every vendor. Carries only
 * the lifetime profile-view count (a single number) plus a flag telling the dashboard whether the
 * vendor is entitled to the gated Pro analytics. Inquiry analytics live in the Pro-only
 * {@link VendorAnalyticsResponse}; they are deliberately not exposed here (issue #371).
 */
public record VendorStatsResponse(
        Integer viewCount,
        Boolean proAnalytics
) {}
