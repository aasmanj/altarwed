package com.altarwed.application.dto;

/**
 * Pro-only vendor analytics, returned by GET /api/v1/vendors/me/analytics. Served only to a vendor
 * whose subscription is ACTIVE (paid Pro or comped); non-Pro vendors get a 403 (issue #371). Beyond
 * the lifetime view count that the free tier also sees, this carries the inquiry analytics (total
 * and unread) that are the paid reason-to-buy. Boxed types per the DTO convention.
 */
public record VendorAnalyticsResponse(
        Integer viewCount,
        Long inquiryCount,
        Long unreadInquiryCount
) {}
