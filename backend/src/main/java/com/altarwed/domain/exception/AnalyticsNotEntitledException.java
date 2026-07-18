package com.altarwed.domain.exception;

import java.util.UUID;

/**
 * Raised when a vendor without Pro-level analytics access requests the gated analytics
 * (inquiry analytics / view time-series). Maps to HTTP 402 Payment Required in the web layer.
 * This is the server-side enforcement of the paywall: the frontend also hides the analytics for
 * non-Pro vendors, but the entitlement must never be trusted from the client alone.
 */
public class AnalyticsNotEntitledException extends RuntimeException {

    public AnalyticsNotEntitledException(UUID vendorId) {
        super("Vendor " + vendorId + " does not have an active Pro subscription for analytics");
    }
}
