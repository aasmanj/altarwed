package com.altarwed.web.controller;

import com.altarwed.application.service.GuestService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.web.security.CoupleAccessGuard;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Self-serve data export for couples (issue #253).
 *
 * GDPR/CCPA data portability without a manual email round-trip. A signed-in couple can download
 * their own guest list (CSV, round-trips back through the spreadsheet importer) and their wedding
 * website content (JSON, scalar fields plus page-builder blocks). Both endpoints are couple-scoped
 * and hard-gated by {@link CoupleAccessGuard#assertOwns} so a couple can only export their OWN data;
 * a mismatched coupleId yields 403 (AccessDeniedException -> GlobalExceptionHandler).
 *
 * Read-only: no ownership guard bypass, no writes, no new migration.
 */
@RestController
@RequestMapping("/api/v1/couples/{coupleId}/export")
public class CoupleExportController {

    private final GuestService guestService;
    private final WeddingWebsiteService weddingWebsiteService;
    private final CoupleAccessGuard accessGuard;

    public CoupleExportController(GuestService guestService,
                                  WeddingWebsiteService weddingWebsiteService,
                                  CoupleAccessGuard accessGuard) {
        this.guestService = guestService;
        this.weddingWebsiteService = weddingWebsiteService;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/guests")
    public ResponseEntity<byte[]> exportGuests(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        byte[] body = guestService.exportGuestsCsv(coupleId).getBytes(StandardCharsets.UTF_8);
        return fileResponse(body, "guest-list-" + LocalDate.now() + ".csv",
                MediaType.parseMediaType("text/csv; charset=utf-8"));
    }

    @GetMapping("/website")
    public ResponseEntity<byte[]> exportWebsite(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        byte[] body = weddingWebsiteService.exportWebsiteJson(coupleId).getBytes(StandardCharsets.UTF_8);
        return fileResponse(body, "wedding-website-" + LocalDate.now() + ".json",
                MediaType.APPLICATION_JSON);
    }

    // Attachment response so the browser downloads the file instead of rendering it in a tab.
    private static ResponseEntity<byte[]> fileResponse(byte[] body, String filename, MediaType contentType) {
        ContentDisposition disposition = ContentDisposition.attachment().filename(filename).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(contentType)
                .body(body);
    }
}
