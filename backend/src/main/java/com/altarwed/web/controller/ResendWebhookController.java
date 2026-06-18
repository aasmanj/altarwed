package com.altarwed.web.controller;

import com.altarwed.application.dto.ResendWebhookEvent;
import com.altarwed.application.service.EmailDeliveryService;
import com.altarwed.infrastructure.email.ResendWebhookVerifier;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Receives Resend delivery webhooks (email.delivered / bounced / complained /
 * delivery_delayed) and records them against the email_delivery log. Public
 * (whitelisted in SecurityConfig) because Resend has no AltarWed JWT; authenticity
 * comes from the Svix signature instead.
 *
 * The raw body is bound as a byte[] so the signature is verified over the exact
 * bytes Resend signed, before any deserialization.
 */
@RestController
@RequestMapping("/api/v1/webhooks/resend")
public class ResendWebhookController {

    private static final Logger log = LoggerFactory.getLogger(ResendWebhookController.class);

    private final ResendWebhookVerifier verifier;
    private final EmailDeliveryService deliveryService;
    private final ObjectMapper objectMapper;

    public ResendWebhookController(ResendWebhookVerifier verifier,
                                   EmailDeliveryService deliveryService,
                                   ObjectMapper objectMapper) {
        this.verifier = verifier;
        this.deliveryService = deliveryService;
        this.objectMapper = objectMapper;
    }

    @PostMapping
    public ResponseEntity<Void> handle(
            @RequestBody(required = false) byte[] body,
            @RequestHeader(value = "svix-id", required = false) String svixId,
            @RequestHeader(value = "svix-timestamp", required = false) String svixTimestamp,
            @RequestHeader(value = "svix-signature", required = false) String svixSignature
    ) {
        if (body == null) {
            log.warn("resend webhook rejected, reason=EMPTY_BODY");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        ResendWebhookVerifier.Result verification = verifier.verify(svixId, svixTimestamp, svixSignature, body);
        if (verification != ResendWebhookVerifier.Result.VALID) {
            // reason is one of NOT_CONFIGURED / MISSING_HEADERS / STALE_TIMESTAMP /
            // BAD_SIGNATURE, so the log says whether this is a config gap or a real
            // signature failure without further digging.
            log.warn("resend webhook rejected, reason={}", verification);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        ResendWebhookEvent event;
        try {
            event = objectMapper.readValue(body, ResendWebhookEvent.class);
        } catch (Exception ex) {
            // Signature was valid but the body will not parse. Retrying cannot help,
            // so acknowledge (200) to stop Resend's redelivery loop.
            log.warn("resend webhook unparseable, acknowledging to stop retries");
            return ResponseEntity.ok().build();
        }

        try {
            deliveryService.process(event);
        } catch (RuntimeException ex) {
            // Transient failure (e.g. DB hiccup). Signal failure so Resend retries.
            log.error("resend webhook processing failed, type={}", event.type(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
        return ResponseEntity.ok().build();
    }
}
