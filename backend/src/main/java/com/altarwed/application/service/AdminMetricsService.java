package com.altarwed.application.service;

import com.altarwed.domain.model.MetricsSnapshot;
import com.altarwed.domain.model.WebsiteRoster;
import com.altarwed.domain.port.MetricsRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AdminMetricsService {

    private final MetricsRepository metricsRepository;
    private final AdminAccessGuard adminAccessGuard;
    private final long paidPlanMonthlyPriceCents;

    public AdminMetricsService(
            MetricsRepository metricsRepository,
            AdminAccessGuard adminAccessGuard,
            @Value("${altarwed.pricing.paid-plan-monthly-cents:2900}") long paidPlanMonthlyPriceCents
    ) {
        this.metricsRepository = metricsRepository;
        this.adminAccessGuard = adminAccessGuard;
        this.paidPlanMonthlyPriceCents = paidPlanMonthlyPriceCents;
    }

    public MetricsSnapshot snapshot(String callerEmail) {
        adminAccessGuard.assertAdmin(callerEmail, "/api/v1/admin/metrics");
        MetricsSnapshot base = metricsRepository.snapshot();
        // MRR = configured monthly price * paying subscribers. Read-only aggregation of the
        // subscription state we already store; no Stripe API call. Annual plans map to the
        // same paid tier and are approximated at the monthly rate for this display figure.
        long mrrCents = base.activePaidSubscriptions() * paidPlanMonthlyPriceCents;
        return base.withMrrCents(mrrCents)
                .withSignupToPublishedRate(signupToPublishedRate(base));
    }

    // Activation conversion: of everyone who signed up, what share got a website published.
    // Derived from counts we already have, so it belongs in the application layer next to MRR
    // rather than in the persistence adapter. max(totalCouples, 1) is the division-by-zero
    // guard: with no couples there is nothing to convert, and publishedWebsites is 0 too
    // (a published website cannot exist without its couple), so the rate reads 0.0.
    private double signupToPublishedRate(MetricsSnapshot base) {
        return (double) base.publishedWebsites() / Math.max(base.totalCouples(), 1L);
    }

    public WebsiteRoster websiteRoster(int page, int size, String callerEmail) {
        adminAccessGuard.assertAdmin(callerEmail, "/api/v1/admin/metrics/websites");
        return metricsRepository.websiteRoster(Math.max(0, page), Math.min(size, 100));
    }
}
