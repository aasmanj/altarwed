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
        List<DailyCount> coupleSignupsLast30Days
) {
    public record DailyCount(LocalDate date, long count) {}
}
