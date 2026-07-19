package com.altarwed.web.controller;

import com.altarwed.application.dto.VendorResponse;
import com.altarwed.application.service.AdminAccessGuard;
import com.altarwed.application.service.VendorService;
import com.altarwed.infrastructure.observability.LogSanitizer;
import com.altarwed.web.mapper.VendorMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/vendors")
public class AdminVendorController {

    private static final Logger log = LoggerFactory.getLogger(AdminVendorController.class);

    private final VendorService vendorService;
    private final VendorMapper vendorMapper;
    private final AdminAccessGuard adminAccessGuard;

    public AdminVendorController(
            VendorService vendorService,
            VendorMapper vendorMapper,
            AdminAccessGuard adminAccessGuard
    ) {
        this.vendorService = vendorService;
        this.vendorMapper = vendorMapper;
        this.adminAccessGuard = adminAccessGuard;
    }

    @PatchMapping("/{id}/verify")
    public ResponseEntity<VendorResponse> verify(@PathVariable UUID id, Authentication auth) {
        adminAccessGuard.assertAdmin(auth, "/api/v1/admin/vendors");
        VendorResponse response = vendorMapper.toResponse(vendorService.verify(id));
        log.info("vendor verified by admin, vendorId={}, adminEmail={}", id,
                LogSanitizer.maskEmail(auth.getName()));
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/unverify")
    public ResponseEntity<VendorResponse> unverify(@PathVariable UUID id, Authentication auth) {
        adminAccessGuard.assertAdmin(auth, "/api/v1/admin/vendors");
        VendorResponse response = vendorMapper.toResponse(vendorService.unverify(id));
        log.info("vendor unverified by admin, vendorId={}, adminEmail={}", id,
                LogSanitizer.maskEmail(auth.getName()));
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        adminAccessGuard.assertAdmin(auth, "/api/v1/admin/vendors");
        log.info("vendor hard delete requested by admin, vendorId={}, adminEmail={}", id,
                LogSanitizer.maskEmail(auth.getName()));
        vendorService.deleteVendor(id);
        return ResponseEntity.noContent().build();
    }
}
