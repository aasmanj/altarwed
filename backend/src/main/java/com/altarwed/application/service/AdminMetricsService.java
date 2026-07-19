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
        return base.withMrrCents(mrrCents);
    }

    public WebsiteRoster websiteRoster(int page, int size, String callerEmail) {
        adminAccessGuard.assertAdmin(callerEmail, "/api/v1/admin/metrics/websites");
        return metricsRepository.websiteRoster(Math.max(0, page), Math.min(size, 100));
    }
}
