package com.altarwed.infrastructure.meta;

import com.altarwed.domain.port.ConversionEventPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Reports conversion events to the Meta Conversions API (server-side pixel).
 * No-op when META_PIXEL_ID or META_CAPI_ACCESS_TOKEN are not configured.
 *
 * Only fires for couples who have given marketingConsent = true at signup.
 * The gate is enforced in WeddingWebsiteService.publish, not here.
 */
@Component
public class MetaCAPIAdapter implements ConversionEventPort {

    private static final Logger log = LoggerFactory.getLogger(MetaCAPIAdapter.class);
    private static final String GRAPH_URL = "https://graph.facebook.com/v19.0";

    private final String pixelId;
    private final String accessToken;
    private final RestClient restClient;

    public MetaCAPIAdapter(
            @Value("${altarwed.meta.pixel-id:}") String pixelId,
            @Value("${altarwed.meta.access-token:}") String accessToken
    ) {
        this.pixelId = pixelId;
        this.accessToken = accessToken;
        this.restClient = RestClient.builder().baseUrl(GRAPH_URL).build();
    }

    @Override
    public void reportLead(String emailHash, String eventSourceUrl, String coupleId) {
        if (pixelId.isBlank() || accessToken.isBlank()) {
            log.debug("meta capi not configured, skipping lead event");
            return;
        }

        Map<String, Object> event = Map.of(
                "event_name", "Lead",
                "event_time", Instant.now().getEpochSecond(),
                "action_source", "website",
                "event_source_url", eventSourceUrl,
                "event_id", "lead-" + coupleId,
                "user_data", Map.of("em", List.of(emailHash))
        );

        Map<String, Object> body = Map.of(
                "data", List.of(event),
                "access_token", accessToken
        );

        log.info("submitting lead event to meta capi, coupleId={}", coupleId);
        try {
            restClient.post()
                    .uri("/{pixelId}/events", pixelId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("meta capi accepted lead event, coupleId={}", coupleId);
        } catch (RestClientException ex) {
            log.warn("meta capi lead event failed, coupleId={}", coupleId, ex);
        }
    }
}
