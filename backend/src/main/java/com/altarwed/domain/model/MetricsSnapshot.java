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
}
