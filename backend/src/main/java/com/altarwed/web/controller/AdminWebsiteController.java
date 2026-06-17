package com.altarwed.web.controller;

import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.infrastructure.observability.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/websites")
public class AdminWebsiteController {

    private static final Logger log = LoggerFactory.getLogger(AdminWebsiteController.class);

    private final WeddingWebsiteService websiteService;
    private final Set<String> adminEmails;

    public AdminWebsiteController(
            WeddingWebsiteService websiteService,
            @Value("${altarwed.admin.emails:}") String adminEmailsCsv
    ) {
        this.websiteService = websiteService;
        this.adminEmails = Arrays.stream(adminEmailsCsv.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug, Authentication auth) {
        checkAdmin(auth);
        websiteService.deleteBySlug(slug);
        log.info("website deleted by admin, slug={}, adminEmail={}", slug,
                LogSanitizer.maskEmail(auth.getName()));
        return ResponseEntity.noContent().build();
    }

    private void checkAdmin(Authentication auth) {
        String callerEmail = auth == null ? null : auth.getName();
        if (callerEmail == null || !adminEmails.contains(callerEmail.toLowerCase())) {
            log.warn("admin website access denied, maskedEmail={}",
                    callerEmail != null ? LogSanitizer.maskEmail(callerEmail) : "null");
            throw new AccessDeniedException("Admin access required");
        }
    }
}
