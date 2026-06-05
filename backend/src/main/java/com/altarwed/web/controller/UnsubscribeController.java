package com.altarwed.web.controller;

import com.altarwed.application.service.EmailSuppressionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/unsubscribe")
public class UnsubscribeController {

    private static final Logger log = LoggerFactory.getLogger(UnsubscribeController.class);

    private final EmailSuppressionService suppressionService;

    public UnsubscribeController(EmailSuppressionService suppressionService) {
        this.suppressionService = suppressionService;
    }

    /**
     * Processes a guest/couple unsubscribe request from the email footer link.
     * The link includes an email hash (h) and an HMAC token (tok) so we can
     * verify authenticity without exposing the email address in the URL.
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> unsubscribe(
            @RequestParam("h") String emailHash,
            @RequestParam("tok") String token
    ) {
        log.info("unsubscribe request received, hash={}", emailHash);
        if (!suppressionService.verifyToken(emailHash, token)) {
            log.warn("unsubscribe token invalid, hash={}", emailHash);
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid unsubscribe link"));
        }
        suppressionService.suppress(emailHash, "USER_REQUEST");
        return ResponseEntity.ok(Map.of("message", "You have been unsubscribed"));
    }
}
