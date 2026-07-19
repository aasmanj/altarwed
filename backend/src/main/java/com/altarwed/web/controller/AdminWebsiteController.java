package com.altarwed.web.controller;

import com.altarwed.application.service.AdminAccessGuard;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.infrastructure.observability.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/websites")
public class AdminWebsiteController {

    private static final Logger log = LoggerFactory.getLogger(AdminWebsiteController.class);

    private final WeddingWebsiteService websiteService;
    private final AdminAccessGuard adminAccessGuard;

    public AdminWebsiteController(
            WeddingWebsiteService websiteService,
            AdminAccessGuard adminAccessGuard
    ) {
        this.websiteService = websiteService;
        this.adminAccessGuard = adminAccessGuard;
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug, Authentication auth) {
        adminAccessGuard.assertAdmin(auth, "/api/v1/admin/websites");
        websiteService.deleteBySlug(slug);
        log.info("website deleted by admin, slug={}, adminEmail={}", slug,
                LogSanitizer.maskEmail(auth.getName()));
        return ResponseEntity.noContent().build();
    }
}
