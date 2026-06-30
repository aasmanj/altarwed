package com.altarwed.web.controller;

import com.altarwed.application.dto.AddWeddingPhotoRequest;
import com.altarwed.application.dto.WeddingPhotoResponse;
import com.altarwed.application.service.MediaUploadService;
import com.altarwed.application.service.WeddingPartyMemberService;
import com.altarwed.application.service.WeddingPhotoService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.web.mapper.WeddingPhotoMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/uploads")
public class MediaUploadController {

    private final MediaUploadService mediaUploadService;
    private final WeddingPartyMemberService weddingPartyMemberService;
    private final WeddingWebsiteService weddingWebsiteService;
    private final WeddingPhotoService weddingPhotoService;
    private final WeddingPhotoMapper weddingPhotoMapper;
    private final CoupleAccessGuard accessGuard;

    public MediaUploadController(
            MediaUploadService mediaUploadService,
            WeddingPartyMemberService weddingPartyMemberService,
            WeddingWebsiteService weddingWebsiteService,
            WeddingPhotoService weddingPhotoService,
            WeddingPhotoMapper weddingPhotoMapper,
            CoupleAccessGuard accessGuard
    ) {
        this.mediaUploadService = mediaUploadService;
        this.weddingPartyMemberService = weddingPartyMemberService;
        this.weddingWebsiteService = weddingWebsiteService;
        this.weddingPhotoService = weddingPhotoService;
        this.weddingPhotoMapper = weddingPhotoMapper;
        this.accessGuard = accessGuard;
    }

    @PostMapping("/wedding-party/{websiteId}/{memberId}/photo")
    public ResponseEntity<Map<String, String>> uploadMemberPhoto(
            @PathVariable UUID websiteId,
            @PathVariable UUID memberId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal String email
    ) throws IOException {
        accessGuard.assertOwnsWebsite(websiteId, email);
        // Verify member belongs to website before uploading
        weddingPartyMemberService.getMemberForUpload(websiteId, memberId);
        String url = mediaUploadService.uploadWeddingPartyPhoto(memberId, file);
        // Patch the member's photoUrl
        weddingPartyMemberService.updatePhotoUrl(websiteId, memberId, url);
        return ResponseEntity.ok(Map.of("photoUrl", url));
    }

    // Upload a photo and register it in the wedding_photos table, returns the full WeddingPhotoResponse
    @PostMapping("/wedding-websites/{websiteId}/photos")
    public ResponseEntity<WeddingPhotoResponse> uploadWeddingPhoto(
            @PathVariable UUID websiteId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "caption", required = false) String caption,
            @RequestParam(value = "sortOrder", required = false) Integer sortOrder,
            @AuthenticationPrincipal String email
    ) throws IOException {
        accessGuard.assertOwnsWebsite(websiteId, email);
        String url = mediaUploadService.uploadWeddingPhoto(websiteId, file);
        AddWeddingPhotoRequest req = new AddWeddingPhotoRequest(url, caption, sortOrder);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(weddingPhotoMapper.toResponse(weddingPhotoService.addPhoto(websiteId, req)));
    }

    // Uploads an image for use in a page block (IMAGE or STORY_ENTRY).
    // Returns just the blob URL, no DB record created. The frontend writes the URL
    // into the block's contentJson via the normal block PATCH flow.
    @PostMapping("/wedding-websites/{websiteId}/block-image")
    public ResponseEntity<Map<String, String>> uploadBlockImage(
            @PathVariable UUID websiteId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal String email
    ) throws IOException {
        accessGuard.assertOwnsWebsite(websiteId, email);
        String url = mediaUploadService.uploadBlockImage(websiteId, file);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @PostMapping("/wedding-websites/{websiteId}/hero")
    public ResponseEntity<Map<String, String>> uploadHeroPhoto(
            @PathVariable UUID websiteId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal String email
    ) throws IOException {
        accessGuard.assertOwnsWebsite(websiteId, email);
        // Capture the prior blob URL before the upload so we can delete it once the new URL is saved
        // (issue #101: replacing a hero photo otherwise leaks the old blob in storage forever).
        String oldUrl = mediaUploadService.currentHeroPhotoUrl(websiteId);
        String url = mediaUploadService.uploadHeroPhoto(websiteId, file);
        weddingWebsiteService.updateHeroPhoto(websiteId, url);
        // Delete the replaced blob only after the new URL is durably persisted. If the persist threw,
        // this line never runs and the old blob is kept; deleteBlobBestEffort itself never throws.
        mediaUploadService.deleteBlobBestEffort(oldUrl, "hero", websiteId);
        return ResponseEntity.ok(Map.of("photoUrl", url));
    }

    @PostMapping("/wedding-websites/{websiteId}/venue-photo")
    public ResponseEntity<Map<String, String>> uploadVenuePhoto(
            @PathVariable UUID websiteId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal String email
    ) throws IOException {
        accessGuard.assertOwnsWebsite(websiteId, email);
        // Capture the prior venue blob before replacing it, then clean it up post-persist (issue #101).
        String oldUrl = mediaUploadService.currentVenuePhotoUrl(websiteId);
        String url = mediaUploadService.uploadVenuePhoto(websiteId, file);
        weddingWebsiteService.updateVenuePhoto(websiteId, url);
        mediaUploadService.deleteBlobBestEffort(oldUrl, "venue", websiteId);
        return ResponseEntity.ok(Map.of("photoUrl", url));
    }

    @PostMapping("/wedding-websites/{websiteId}/std-image")
    public ResponseEntity<Map<String, String>> uploadStdImage(
            @PathVariable UUID websiteId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal String email
    ) throws IOException {
        accessGuard.assertOwnsWebsite(websiteId, email);
        // Capture the prior save-the-date blob before replacing it, then clean it up post-persist (issue #101).
        String oldUrl = mediaUploadService.currentStdImageUrl(websiteId);
        String url = mediaUploadService.uploadStdImage(websiteId, file);
        weddingWebsiteService.updateStdImage(websiteId, url);
        mediaUploadService.deleteBlobBestEffort(oldUrl, "std", websiteId);
        return ResponseEntity.ok(Map.of("imageUrl", url));
    }

    @DeleteMapping("/wedding-websites/{websiteId}/std-image")
    public ResponseEntity<Void> removeStdImage(
            @PathVariable UUID websiteId,
            @AuthenticationPrincipal String email
    ) {
        accessGuard.assertOwnsWebsite(websiteId, email);
        weddingWebsiteService.updateStdImage(websiteId, null);
        return ResponseEntity.noContent().build();
    }
}
