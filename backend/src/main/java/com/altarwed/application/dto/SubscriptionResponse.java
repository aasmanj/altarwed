package com.altarwed.application.dto;

import java.time.LocalDateTime;

public record SubscriptionResponse(
        String planTier,
        String status,
        LocalDateTime currentPeriodEnd,
        String proMonthlyPriceId,
        String proAnnualPriceId
) {}
