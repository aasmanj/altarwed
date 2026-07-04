package com.altarwed.web.controller;

import com.altarwed.application.dto.LobWebhookEvent;
import com.altarwed.application.service.LobWebhookService;
import com.altarwed.infrastructure.lob.LobWebhookVerifier;
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
 * Receives Lob mail-piece lifecycle webhooks (postcard.mailed / in_transit / delivered /
 * returned_to_sender / ...) and records them against print_order_recipients (issue #52). Public
 * (whitelisted in SecurityConfig) because Lob has no AltarWed JWT; authenticity comes from the
 * Lob-Signature header instead. Structurally identical to ResendWebhookController.
 *
 * The raw body is bound as a byte[] so the signature is verified over the exact bytes Lob
 * signed, before any deserialization.
 */
@RestController
@RequestMapping("/api/v1/webhooks/lob")
public class LobWebhookController {

    private static final Logger log = LoggerFactory.getLogger(LobWebhookController.class);

    private final LobWebhookVerifier verifier;
    private final LobWebhookService webhookService;
    private final ObjectMapper objectMapper;

    public LobWebhookController(LobWebhookVerifier verifier,
                                LobWebhookService webhookService,
                                ObjectMapper objectMapper) {
        this.verifier = verifier;
        this.webhookService = webhookService;
        this.objectMapper = objectMapper;
    }

    @PostMapping
    public ResponseEntity<Void> handle(
            @RequestBody(required = false) byte[] body,
            @RequestHeader(value = "Lob-Signature", required = false) String lobSignature,
            @RequestHeader(value = "Lob-Signature-Timestamp", required = false) String lobSignatureTimestamp
    ) {
        if (body == null) {
            log.warn("lob webhook rejected, reason=EMPTY_BODY");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        LobWebhookVerifier.Result verification = verifier.verify(lobSignature, lobSignatureTimestamp, body);
        if (verification != LobWebhookVerifier.Result.VALID) {
            // reason is one of NOT_CONFIGURED / MISSING_HEADERS / STALE_TIMESTAMP / BAD_SIGNATURE,
            // so the log says whether this is a config gap or a real signature failure without
            // further digging.
            log.warn("lob webhook rejected, reason={}", verification);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        LobWebhookEvent event;
        try {
            event = objectMapper.readValue(body, LobWebhookEvent.class);
        } catch (Exception ex) {
            // Signature was valid but the body will not parse. Retrying cannot help, so
            // acknowledge (200) to stop Lob's redelivery loop.
            log.warn("lob webhook unparseable, acknowledging to stop retries");
            return ResponseEntity.ok().build();
        }

        try {
            webhookService.process(event);
        } catch (RuntimeException ex) {
            // Transient failure (e.g. DB hiccup). Signal failure so Lob retries.
            log.error("lob webhook processing failed, type={}",
                    event.eventType() != null ? event.eventType().id() : null, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
        return ResponseEntity.ok().build();
    }
}
