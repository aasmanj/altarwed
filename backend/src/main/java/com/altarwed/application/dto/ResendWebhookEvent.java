package com.altarwed.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Shape of a Resend webhook payload (the subset we consume). Resend sends a
 * top-level {@code type} (e.g. "email.delivered"), a {@code created_at} event
 * timestamp, and a {@code data} object with the email's id, recipients, the tags
 * we attached at send time, and, for bounces, a {@code bounce} block.
 *
 * Unknown fields (broadcast_id, template_id, from, subject, ...) are ignored so a
 * provider-side payload change never breaks deserialization.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ResendWebhookEvent(
        String type,
        @JsonProperty("created_at") String createdAt,
        Data data
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Data(
            @JsonProperty("email_id") String emailId,
            List<String> to,
            // Tags are sent as an array of {name,value} but echoed back as a flat
            // object {name: value}, so we bind them as a map.
            Map<String, String> tags,
            Bounce bounce
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Bounce(
            String type,
            String subType,
            String message
    ) {}
}
