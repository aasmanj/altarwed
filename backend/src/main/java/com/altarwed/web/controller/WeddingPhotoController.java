package com.altarwed.web.controller;

import com.altarwed.application.dto.AddWeddingPhotoRequest;
import com.altarwed.application.dto.UpdateWeddingPhotoRequest;
import com.altarwed.application.dto.WeddingPhotoResponse;
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

    public WeddingPhotoController(WeddingPhotoService service, WeddingPhotoMapper mapper, CoupleAccessGuard accessGuard) {
        this.service = service;
        this.mapper = mapper;
        this.accessGuard = accessGuard;
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

    @DeleteMapping("/website/{websiteId}/{photoId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID websiteId,
            @PathVariable UUID photoId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        service.deletePhoto(websiteId, photoId);
        return ResponseEntity.noContent().build();
    }
}
