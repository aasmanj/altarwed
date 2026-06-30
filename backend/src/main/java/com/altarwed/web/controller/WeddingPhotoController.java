package com.altarwed.web.controller;

import com.altarwed.application.dto.AddWeddingPhotoRequest;
import com.altarwed.application.dto.ReorderWeddingPhotosRequest;
import com.altarwed.application.dto.UpdateWeddingPhotoRequest;
import com.altarwed.application.dto.WeddingPhotoResponse;
import com.altarwed.application.service.MediaUploadService;
import com.altarwed.application.service.WeddingPhotoService;
import com.altarwed.web.mapper.WeddingPhotoMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wedding-photos")
public class WeddingPhotoController {

    private final WeddingPhotoService service;
    private final WeddingPhotoMapper mapper;
    private final CoupleAccessGuard accessGuard;
    private final MediaUploadService mediaUploadService;

    public WeddingPhotoController(WeddingPhotoService service, WeddingPhotoMapper mapper,
                                  CoupleAccessGuard accessGuard, MediaUploadService mediaUploadService) {
        this.service = service;
        this.mapper = mapper;
        this.accessGuard = accessGuard;
        this.mediaUploadService = mediaUploadService;
    }

    // Public, fetched by Next.js /wedding/[slug]/photos page
    @GetMapping("/website/slug/{slug}")
    public ResponseEntity<List<WeddingPhotoResponse>> listBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(service.listPhotosBySlug(slug).stream().map(mapper::toResponse).toList());
    }

    // Authenticated, couple dashboard manages photos
    @GetMapping("/website/{websiteId}")
    public ResponseEntity<List<WeddingPhotoResponse>> list(
            @PathVariable UUID websiteId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        return ResponseEntity.ok(service.listPhotos(websiteId).stream().map(mapper::toResponse).toList());
    }

    @PostMapping("/website/{websiteId}")
    public ResponseEntity<WeddingPhotoResponse> add(
            @PathVariable UUID websiteId,
            @Valid @RequestBody AddWeddingPhotoRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mapper.toResponse(service.addPhoto(websiteId, request)));
    }

    @PatchMapping("/website/{websiteId}/{photoId}")
    public ResponseEntity<WeddingPhotoResponse> update(
            @PathVariable UUID websiteId,
            @PathVariable UUID photoId,
            @Valid @RequestBody UpdateWeddingPhotoRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        return ResponseEntity.ok(mapper.toResponse(service.updatePhoto(websiteId, photoId, request)));
    }

    @PatchMapping("/website/{websiteId}/reorder")
    public ResponseEntity<Void> reorder(
            @PathVariable UUID websiteId,
            @Valid @RequestBody ReorderWeddingPhotosRequest request,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        service.reorderPhotos(websiteId, request.orderedIds());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/website/{websiteId}/{photoId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID websiteId,
            @PathVariable UUID photoId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        // deletePhoto returns the photo's URL; delete its blob after the row delete commits so the
        // blob is not orphaned in storage (issue #101). Best-effort, never fails the request.
        String url = service.deletePhoto(websiteId, photoId);
        mediaUploadService.deleteBlobBestEffort(url, "album-photo", websiteId);
        return ResponseEntity.noContent().build();
    }
}
