package com.altarwed.web.controller;

import com.altarwed.application.dto.StripeCheckoutRequest;
import com.altarwed.application.service.StripeService;
import com.altarwed.application.service.VendorService;
import com.altarwed.domain.port.StripePort.StripeCallException;
import com.stripe.exception.SignatureVerificationException;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/stripe")
public class StripeController {

    private static final Logger log = LoggerFactory.getLogger(StripeController.class);

    private final StripeService stripeService;
    private final VendorService vendorService;

    public StripeController(StripeService stripeService, VendorService vendorService) {
        this.stripeService = stripeService;
        this.vendorService = vendorService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<Map<String, String>> checkout(
            Authentication auth,
            @Valid @RequestBody StripeCheckoutRequest req
    ) {
        var vendor = vendorService.getByEmail(auth.getName());
        log.info("stripe checkout requested, vendorId={}", vendor.id());
        String url = stripeService.createCheckoutSession(vendor.id(), vendor.email(), req.priceId());
        return ResponseEntity.ok(Map.of("url", url));
    }

    @PostMapping("/portal")
    public ResponseEntity<Map<String, String>> portal(Authentication auth) {
        var vendor = vendorService.getByEmail(auth.getName());
        log.info("stripe portal requested, vendorId={}", vendor.id());
        String url = stripeService.createPortalSession(vendor.id());
        return ResponseEntity.ok(Map.of("url", url));
    }

    /**
     * Stripe-signed webhook -- no JWT auth. Excluded from the JWT filter in SecurityConfig.
     * Raw bytes are required to preserve the HMAC signature; Jackson must not parse first.
     *
     * HTTP semantics: 2xx = acknowledged (no retry), 4xx = client error (no retry),
     * 5xx = server error (Stripe retries). Bad signature = 400 (no retry). DB errors
     * propagate as 500 so Stripe can retry on transient failures.
     */
    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(
            @RequestBody byte[] payload,
            @RequestHeader("Stripe-Signature") String sigHeader
    ) {
        try {
            stripeService.handleWebhook(payload, sigHeader);
        } catch (StripeCallException e) {
            if (e.getCause() instanceof SignatureVerificationException) {
                log.warn("stripe webhook invalid signature, rejecting with 400");
                return ResponseEntity.badRequest().build();
            }
            log.warn("stripe webhook processing failed, message={}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
        return ResponseEntity.ok().build();
    }

    @ExceptionHandler(StripeCallException.class)
    public ResponseEntity<Map<String, String>> handleStripeCallException(StripeCallException e) {
        log.warn("stripe call exception, message={}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("error", "Stripe integration error. Please try again."));
    }
}
