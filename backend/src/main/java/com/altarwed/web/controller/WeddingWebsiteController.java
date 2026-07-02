package com.altarwed.web.controller;

import com.altarwed.application.dto.CreateWeddingWebsiteRequest;
import com.altarwed.application.dto.UpdateWeddingWebsiteRequest;
import com.altarwed.application.dto.WeddingWebsiteResponse;
import com.altarwed.application.dto.WeddingWebsiteSearchResultResponse;
import com.altarwed.application.dto.WeddingWebsiteSitemapEntry;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.web.mapper.WeddingWebsiteMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wedding-websites")
public class WeddingWebsiteController {

    private final WeddingWebsiteService websiteService;
    private final WeddingWebsiteMapper mapper;
    private final CoupleAccessGuard accessGuard;

    public WeddingWebsiteController(WeddingWebsiteService websiteService, WeddingWebsiteMapper mapper, CoupleAccessGuard accessGuard) {
        this.websiteService = websiteService;
        this.mapper = mapper;
        this.accessGuard = accessGuard;
    }

    // Public, fetched by the Next.js SSR page at /wedding/[slug]
    @GetMapping("/slug/{slug}")
    public ResponseEntity<WeddingWebsiteResponse> getBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(mapper.toResponse(websiteService.getBySlug(slug)));
    }

    // Public, search published websites by partner name and/or wedding year
    @GetMapping("/search")
    public ResponseEntity<List<WeddingWebsiteSearchResultResponse>> search(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Integer year
    ) {
        return ResponseEntity.ok(websiteService.search(name, year));
    }

    // Public, fetched by sitemap.ts to build /sitemap.xml (slug + updatedAt only, no PII)
    @GetMapping("/published")
    public ResponseEntity<List<WeddingWebsiteSitemapEntry>> getAllPublished() {
        List<WeddingWebsiteSitemapEntry> entries = websiteService.getAllPublished()
                .stream()
                .map(s -> new WeddingWebsiteSitemapEntry(s.slug(), s.updatedAt()))
                .toList();
        return ResponseEntity.ok(entries);
    }

    // Authenticated, couple managing their own website
    @PostMapping("/couple/{coupleId}")
    public ResponseEntity<WeddingWebsiteResponse> create(
            @PathVariable UUID coupleId,
            @Valid @RequestBody CreateWeddingWebsiteRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(websiteService.create(coupleId, email, request)));
    }

    @GetMapping("/couple/{coupleId}")
    public ResponseEntity<WeddingWebsiteResponse> getByCoupleId(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(mapper.toResponse(websiteService.getByCoupleId(coupleId)));
    }

    @PatchMapping("/couple/{coupleId}")
    public ResponseEntity<WeddingWebsiteResponse> update(
            @PathVariable UUID coupleId,
            @Valid @RequestBody UpdateWeddingWebsiteRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(mapper.toResponse(websiteService.update(coupleId, request)));
    }

    @PostMapping("/couple/{coupleId}/publish")
    public ResponseEntity<WeddingWebsiteResponse> publish(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(mapper.toResponse(websiteService.publish(coupleId)));
    }

    @PostMapping("/couple/{coupleId}/unpublish")
    public ResponseEntity<WeddingWebsiteResponse> unpublish(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        return ResponseEntity.ok(mapper.toResponse(websiteService.unpublish(coupleId)));
    }

    @DeleteMapping("/couple/{coupleId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID coupleId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwns(coupleId, email);
        websiteService.delete(coupleId);
        return ResponseEntity.noContent().build();
    }
}
