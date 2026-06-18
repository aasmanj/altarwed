package com.altarwed.application.dto;

/**
 * Per-guest rollup of the latest delivery status for each tracked email type,
 * merged into {@link GuestResponse} so the dashboard can show a delivered/bounced
 * stamp next to each guest. Values are {@link com.altarwed.domain.model.EmailDeliveryStatus}
 * names (e.g. "DELIVERED", "BOUNCED") or null when no webhook event has arrived yet.
 */
public record GuestDeliverySummary(
        String saveTheDateDeliveryStatus,
        String inviteDeliveryStatus
) {}
