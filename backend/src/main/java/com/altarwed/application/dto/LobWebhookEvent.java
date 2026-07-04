package com.altarwed.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Shape of a Lob webhook payload (the subset we consume). Lob sends a top-level
 * {@code event_type.id} (e.g. "postcard.delivered"), a {@code date_created} event timestamp, and
 * a {@code body} object -- the mail piece itself -- whose {@code id} is the same Lob postcard id
 * ({@code lob_postcard_id}) stored on {@code print_order_recipients} at send time, and which
 * carries the best-effort {@code tracking_number}/{@code expected_delivery_date} fields also used
 * by the polling fallback ({@code LobPrintMailAdapter.fetchPostcardStatus}).
 *
 * Unknown fields are ignored so a provider-side payload change never breaks deserialization.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LobWebhookEvent(
        String id,
        @JsonProperty("date_created") String dateCreated,
        @JsonProperty("event_type") EventType eventType,
        Body body
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EventType(String id) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(
            String id,
            @JsonProperty("tracking_number") String trackingNumber,
            @JsonProperty("expected_delivery_date") String expectedDeliveryDate
    ) {}
}
