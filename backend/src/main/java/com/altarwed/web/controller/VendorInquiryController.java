package com.altarwed.web.controller;

import com.altarwed.application.dto.SendInquiryRequest;
import com.altarwed.application.service.VendorInquiryService;
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
 * filter level (RateLimitingFilter applies to /api/v1/inquiries).
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
    public ResponseEntity<Void> send(@Valid @RequestBody SendInquiryRequest request) {
        inquiryService.send(request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }
}
