package com.altarwed.web.controller;

import com.altarwed.application.dto.CreatePromoCodeRequest;
import com.altarwed.application.dto.PromoCodeResponse;
import com.altarwed.application.service.VendorPromoService;
import com.altarwed.domain.model.VendorPromoCode;
import com.altarwed.infrastructure.observability.LogSanitizer;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Admin endpoints to issue and inspect DB-backed vendor comp promo codes. Gated by the same
 * altarwed.admin.emails whitelist / checkAdmin() pattern as AdminVendorController, so no
 * SecurityConfig change is needed (these paths are outside the public whitelist and require auth).
 * The controller calls through VendorPromoService and never touches JPA repositories directly.
 */
@RestController
@RequestMapping("/api/v1/admin/promo-codes")
public class AdminPromoCodeController {

    private static final Logger log = LoggerFactory.getLogger(AdminPromoCodeController.class);

    private final VendorPromoService promoService;
    private final Set<String> adminEmails;

    public AdminPromoCodeController(
            VendorPromoService promoService,
            @Value("${altarwed.admin.emails:}") String adminEmailsCsv
    ) {
        this.promoService = promoService;
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    @PostMapping
    public ResponseEntity<PromoCodeResponse> create(
            @Valid @RequestBody CreatePromoCodeRequest req,
            Authentication auth
    ) {
        checkAdmin(auth);
        VendorPromoCode code = promoService.createPromoCode(req.code(), req.maxRedemptions(), req.expiresAt());
        log.info("promo code created by admin, codeId={}, adminEmail={}", code.id(),
                LogSanitizer.maskEmail(auth.getName()));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(code));
    }

    @GetMapping
    public ResponseEntity<List<PromoCodeResponse>> list(Authentication auth) {
        checkAdmin(auth);
        List<PromoCodeResponse> codes = promoService.listPromoCodes().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(codes);
    }

    private PromoCodeResponse toResponse(VendorPromoCode c) {
        return new PromoCodeResponse(c.code(), c.maxRedemptions(), c.redeemedCount(), c.expiresAt());
    }

    private void checkAdmin(Authentication auth) {
        String callerEmail = auth == null ? null : auth.getName();
        if (callerEmail == null || !adminEmails.contains(callerEmail.toLowerCase())) {
            log.warn("admin promo code access denied, maskedEmail={}",
                    callerEmail != null ? LogSanitizer.maskEmail(callerEmail) : "null");
            throw new AccessDeniedException("Admin access required");
        }
    }
}
