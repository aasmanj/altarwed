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
        List<SourceCount> topAcquisitionSources,
        // Activation funnel step 1: publishedWebsites / max(totalCouples, 1), a ratio in 0..1.
        // Boxed per the DTO rule but normalized to 0.0 in the canonical constructor, so it is
        // never null on the wire. Computed in AdminMetricsService, not here and not in the
        // persistence adapter, because it is a derived business figure rather than a stored count.
        //
        // Funnel step 2 (published->shared) has no server-side source of truth: share actions
        // fire client-side analytics only, there is no shares table to query. Read it from PostHog.
        // Published->shared: PostHog query -- select count(distinct person) where event = 'share_link_copied' or event = 'share_sms_clicked' or event = 'share_facebook_clicked', grouped by has_published_website
        Double signupToPublishedRate
) {
    public MetricsSnapshot {
        // Defensive normalization: callers using the legacy 21-arg constructor, or a JSON
        // payload that omits the field, must still see 0.0 rather than a null ratio.
        signupToPublishedRate = signupToPublishedRate == null ? 0.0d : signupToPublishedRate;
    }

    /**
     * Raw-counts constructor for persistence adapters, which know the stored counts but not
     * the derived rates. Leaves the conversion rate at 0.0 for the application layer to fill in.
     */
    public MetricsSnapshot(
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
        this(totalCouples, couplesLast7Days, couplesLast30Days,
                totalWebsites, publishedWebsites,
                totalGuests, totalRsvpsAttending, totalRsvpsDeclining,
                totalVendors, activeVendors, verifiedVendors,
                activePaidSubscriptions, mrrCents, totalInquiries,
                totalBlogPosts, totalBudgetItems, totalCeremonySections,
                totalPlanningTasks, totalWeddingPhotos,
                coupleSignupsLast30Days, topAcquisitionSources,
                0.0d);
    }

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
                coupleSignupsLast30Days, topAcquisitionSources,
                signupToPublishedRate);
    }

    /**
     * Returns a copy with the signup to published conversion rate set. Takes a primitive so a
     * null ratio is unrepresentable at the call site; the component itself stays boxed per the
     * DTO rule.
     */
    public MetricsSnapshot withSignupToPublishedRate(double signupToPublishedRate) {
        return new MetricsSnapshot(
                totalCouples, couplesLast7Days, couplesLast30Days,
                totalWebsites, publishedWebsites,
                totalGuests, totalRsvpsAttending, totalRsvpsDeclining,
                totalVendors, activeVendors, verifiedVendors,
                activePaidSubscriptions, mrrCents, totalInquiries,
                totalBlogPosts, totalBudgetItems, totalCeremonySections,
                totalPlanningTasks, totalWeddingPhotos,
                coupleSignupsLast30Days, topAcquisitionSources,
                signupToPublishedRate);
    }
}
