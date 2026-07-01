package com.altarwed.domain.model;

import java.time.LocalDate;
import java.util.List;

public record MetricsSnapshot(
        long totalCouples,
        long couplesLast7Days,
        long couplesLast30Days,
        long totalWebsites,
        long publishedWebsites,
        long totalGuests,
        long totalRsvpsAttending,
        long totalRsvpsDeclining,
        long totalVendors,
        long activeVendors,
        long verifiedVendors,
        long activePaidSubscriptions,
        long mrrCents,
        long totalInquiries,
        long totalBlogPosts,
        long totalBudgetItems,
        long totalCeremonySections,
        long totalPlanningTasks,
        long totalWeddingPhotos,
        List<DailyCount> coupleSignupsLast30Days,
        List<SourceCount> topAcquisitionSources
) {
    public record DailyCount(LocalDate date, long count) {}

    /** A single acquisition channel and how many couples it brought in. */
    public record SourceCount(String source, long count) {}

    /**
     * Returns a copy with monthly recurring revenue set. MRR is a business figure derived
     * from the active paid count and the configured plan price, so it is computed in the
     * application layer (AdminMetricsService), not the persistence adapter which only knows
     * counts.
     */
    public MetricsSnapshot withMrrCents(long mrrCents) {
        return new MetricsSnapshot(
                totalCouples, couplesLast7Days, couplesLast30Days,
                totalWebsites, publishedWebsites,
                totalGuests, totalRsvpsAttending, totalRsvpsDeclining,
                totalVendors, activeVendors, verifiedVendors,
                activePaidSubscriptions, mrrCents, totalInquiries,
                totalBlogPosts, totalBudgetItems, totalCeremonySections,
                totalPlanningTasks, totalWeddingPhotos,
                coupleSignupsLast30Days, topAcquisitionSources);
    }
}
