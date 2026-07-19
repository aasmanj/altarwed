package com.altarwed.web.controller;

import com.altarwed.application.dto.CreatePromoCodeRequest;
import com.altarwed.application.dto.PromoCodeResponse;
import com.altarwed.application.service.AdminAccessGuard;
import com.altarwed.application.service.VendorPromoService;
import com.altarwed.domain.model.VendorPromoCode;
import com.altarwed.infrastructure.observability.LogSanitizer;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin endpoints to issue and inspect DB-backed vendor comp promo codes. Gated by the shared
 * AdminAccessGuard (altarwed.admin.emails whitelist), same as the other admin controllers, so no
 * SecurityConfig change is needed (these paths are outside the public whitelist and require auth).
 * The controller calls through VendorPromoService and never touches JPA repositories directly.
 */
@RestController
@RequestMapping("/api/v1/admin/promo-codes")
public class AdminPromoCodeController {

    private static final Logger log = LoggerFactory.getLogger(AdminPromoCodeController.class);

    private final VendorPromoService promoService;
    private final AdminAccessGuard adminAccessGuard;

    public AdminPromoCodeController(
            VendorPromoService promoService,
            AdminAccessGuard adminAccessGuard
    ) {
        this.promoService = promoService;
        this.adminAccessGuard = adminAccessGuard;
    }

    @PostMapping
    public ResponseEntity<PromoCodeResponse> create(
            @Valid @RequestBody CreatePromoCodeRequest req,
            Authentication auth
    ) {
        adminAccessGuard.assertAdmin(auth, "/api/v1/admin/promo-codes");
        VendorPromoCode code = promoService.createPromoCode(req.code(), req.maxRedemptions(), req.expiresAt());
        log.info("promo code created by admin, codeId={}, adminEmail={}", code.id(),
                LogSanitizer.maskEmail(auth.getName()));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(code));
    }

    @GetMapping
    public ResponseEntity<List<PromoCodeResponse>> list(Authentication auth) {
        adminAccessGuard.assertAdmin(auth, "/api/v1/admin/promo-codes");
        List<PromoCodeResponse> codes = promoService.listPromoCodes().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(codes);
    }

    private PromoCodeResponse toResponse(VendorPromoCode c) {
        return new PromoCodeResponse(c.code(), c.maxRedemptions(), c.redeemedCount(), c.expiresAt());
    }
}
