package com.altarwed.web.controller;

import com.altarwed.application.dto.SendInquiryRequest;
import com.altarwed.application.service.VendorInquiryService;
import com.altarwed.infrastructure.security.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public, unauthenticated POST surface for couples to message vendors before
 * creating an account. Whitelisted in SecurityConfig and rate-limited at the
 * filter level (RateLimitingFilter applies to /api/v1/inquiries). Issue #100
 * adds two more gates inside the service: Turnstile captcha verification (same
 * adapter as the RSVP find path, #89) and a per-vendor rolling send cap, since
 * the per-IP filter alone is bypassable by X-Forwarded-For rotation (#41).
 *
 * 202 Accepted is used because the email send is queued on the async executor
 *, by the time the response returns, the message has not yet been delivered.
 * 204 would imply completion; 202 is the truthful status.
 */
@RestController
@RequestMapping("/api/v1/inquiries")
public class VendorInquiryController {

    private final VendorInquiryService inquiryService;

    public VendorInquiryController(VendorInquiryService inquiryService) {
        this.inquiryService = inquiryService;
    }

    @PostMapping
    public ResponseEntity<Void> send(
            @Valid @RequestBody SendInquiryRequest request,
            HttpServletRequest httpRequest
    ) {
        // Real client IP behind Azure App Service (trusted last X-Forwarded-For hop),
        // forwarded to Turnstile's siteverify as an extra signal, same as the RSVP path.
        String remoteIp = ClientIpResolver.resolve(httpRequest);
        inquiryService.send(request, remoteIp);
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }
}
