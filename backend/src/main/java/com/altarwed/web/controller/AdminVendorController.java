package com.altarwed.web.controller;

import com.altarwed.application.dto.VendorResponse;
import com.altarwed.application.service.VendorService;
import com.altarwed.infrastructure.observability.LogSanitizer;
import com.altarwed.web.mapper.VendorMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/vendors")
public class AdminVendorController {

    private static final Logger log = LoggerFactory.getLogger(AdminVendorController.class);

    private final VendorService vendorService;
    private final VendorMapper vendorMapper;
    private final Set<String> adminEmails;

    public AdminVendorController(
            VendorService vendorService,
            VendorMapper vendorMapper,
            @Value("${altarwed.admin.emails:}") String adminEmailsCsv
    ) {
        this.vendorService = vendorService;
        this.vendorMapper = vendorMapper;
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    @PatchMapping("/{id}/verify")
    public ResponseEntity<VendorResponse> verify(@PathVariable UUID id, Authentication auth) {
        checkAdmin(auth);
        VendorResponse response = vendorMapper.toResponse(vendorService.verify(id));
        log.info("vendor verified by admin, vendorId={}, adminEmail={}", id,
                LogSanitizer.maskEmail(auth.getName()));
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/unverify")
    public ResponseEntity<VendorResponse> unverify(@PathVariable UUID id, Authentication auth) {
        checkAdmin(auth);
        VendorResponse response = vendorMapper.toResponse(vendorService.unverify(id));
        log.info("vendor unverified by admin, vendorId={}, adminEmail={}", id,
                LogSanitizer.maskEmail(auth.getName()));
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        checkAdmin(auth);
        log.info("vendor hard delete requested by admin, vendorId={}, adminEmail={}", id,
                LogSanitizer.maskEmail(auth.getName()));
        vendorService.deleteVendor(id);
        return ResponseEntity.noContent().build();
    }

    private void checkAdmin(Authentication auth) {
        String callerEmail = auth == null ? null : auth.getName();
        if (callerEmail == null || !adminEmails.contains(callerEmail.toLowerCase())) {
            log.warn("admin vendor access denied, maskedEmail={}",
                    callerEmail != null ? LogSanitizer.maskEmail(callerEmail) : "null");
            throw new AccessDeniedException("Admin access required");
        }
    }
}
