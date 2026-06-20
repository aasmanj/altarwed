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
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/unsubscribe")
public class UnsubscribeController {

    private static final Logger log = LoggerFactory.getLogger(UnsubscribeController.class);

    private final EmailSuppressionService suppressionService;

    public UnsubscribeController(EmailSuppressionService suppressionService) {
        this.suppressionService = suppressionService;
    }

    /**
     * Processes an unsubscribe from an email footer link. The link carries an email hash
     * (h), an HMAC token (tok), and, for guest-facing mail, the sending couple (c) so the
     * unsubscribe is scoped to THAT wedding (The Knot/Zola model): unsubscribing from one
     * couple's mail does not silence another's. Links with no couple (welcome mail, or
     * links sent before per-couple scoping) fall back to a global voluntary opt-out, so
     * tokens already in inboxes keep working.
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> unsubscribe(
            @RequestParam("h") String emailHash,
            @RequestParam("tok") String token,
            @RequestParam(value = "c", required = false) UUID coupleId
    ) {
        log.info("unsubscribe request received, hash={}, scoped={}", emailHash, coupleId != null);
        if (!suppressionService.verifyToken(emailHash, coupleId, token)) {
            log.warn("unsubscribe token invalid, hash={}", emailHash);
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid unsubscribe link"));
        }
        if (coupleId != null) {
            suppressionService.coupleUnsubscribe(coupleId, emailHash);
        } else {
            suppressionService.globalUnsubscribe(emailHash);
        }
        return ResponseEntity.ok(Map.of("message", "You have been unsubscribed"));
    }
}
