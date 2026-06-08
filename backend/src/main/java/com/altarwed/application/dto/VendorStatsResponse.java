package com.altarwed.application.dto;

public record VendorStatsResponse(
        Integer viewCount,
        Long inquiryCount,
        Long unreadInquiryCount
) {}
