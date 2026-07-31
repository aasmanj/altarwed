package com.altarwed.web.controller;

import com.altarwed.application.dto.CreateWeddingWebsiteRequest;
import com.altarwed.application.dto.DraftWeddingWebsiteResponse;
import com.altarwed.application.dto.PublicWeddingWebsiteResponse;
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

    // Public, fetched by the Next.js SSR page at /wedding/[slug]. A published site returns the
    // full public DTO (#97: omits coupleId and goalBudget, neither of which belongs in an
    // anonymous-guest payload). An existing-but-unpublished draft returns 200 with the slim
    // draft-state body instead of the pre-#537 404, so the SEO surface renders ComingSoon
    // straight from this response without probing /preview and without Next's Data Cache ever
    // holding a full draft DTO. Missing and soft-deleted slugs still 404
    // (getBySlugForPreview enforces the deleted check).
    @GetMapping("/slug/{slug}")
    public ResponseEntity<Object> getBySlug(@PathVariable String slug) {
        var website = websiteService.getBySlugForPreview(slug);
        if (!website.isPublished()) {
            return ResponseEntity.ok(DraftWeddingWebsiteResponse.of(website));
        }
        return ResponseEntity.ok(mapper.toPublicResponse(website));
    }

    // Preview, fetched by the Next.js /preview/[slug]/[tab] iframe. Renders drafts;
    // see WeddingWebsiteService.getBySlugForPreview for the trust model. The slug is the only
    // capability check (no JWT crosses the iframe boundary), so this is anonymously reachable
    // the same as /slug/{slug} -- uses the same public DTO for the same reason (#97).
    // ALSO still a fallback for the public site's "coming soon" page: frontend-public keeps
    // probeUnpublished (wedding/[slug]/data.ts) for deploy-skew windows where /slug/{slug}
    // still 404s drafts (pre-#537 backend). DraftPreviewAnonymousReachabilityTest pins the
    // anonymous draft reachability until that probe is deleted.
    @GetMapping("/preview/{slug}")
    public ResponseEntity<PublicWeddingWebsiteResponse> getBySlugForPreview(@PathVariable String slug) {
        return ResponseEntity.ok(mapper.toPublicResponse(websiteService.getBySlugForPreview(slug)));
    }

    // Public, search published websites by partner name and/or wedding year
    @GetMapping("/search")
    public ResponseEntity<List<WeddingWebsiteSearchResultResponse>> search(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Integer year
    ) {
        return ResponseEntity.ok(websiteService.search(name, year));
    }

    // Public, fetched by sitemapData.ts to build /sitemap.xml (slug + updatedAt only, no PII).
    // Paged (issue #241): the feed is deterministic (ordered by id) and bounded per request, so it
    // never streams the whole published-sites table as the catalog grows. The sitemap loader walks
    // pages until one comes back short. page is zero-based; size defaults to the server-side ceiling
    // and is clamped in the service. Boxed Integer request params carry the defaults.
    @GetMapping("/published")
    public ResponseEntity<List<WeddingWebsiteSitemapEntry>> getAllPublished(
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "1000") Integer size
    ) {
        List<WeddingWebsiteSitemapEntry> entries = websiteService.getPublishedPage(page, size)
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
