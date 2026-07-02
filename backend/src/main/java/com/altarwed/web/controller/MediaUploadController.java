package com.altarwed.web.controller;

import com.altarwed.application.dto.AddWeddingPhotoRequest;
import com.altarwed.application.dto.WeddingPhotoResponse;
import com.altarwed.application.service.MediaUploadService;
import com.altarwed.application.service.WeddingPartyMemberService;
import com.altarwed.application.service.WeddingPhotoService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.domain.model.WeddingPhoto;
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
        WeddingPhoto photo;
        try {
            photo = weddingPhotoService.addPhoto(websiteId, req);
        } catch (RuntimeException ex) {
            // The blob upload already succeeded, so a failed DB insert would strand the blob in
            // storage forever with no row referencing it (issue #150). Best-effort delete the
            // just-uploaded blob before rethrowing so a failed request leaves no orphan. This
            // mirrors the compensating-cleanup pattern used on the replace paths above;
            // deleteBlobBestEffort never throws, so it cannot mask the original failure.
            mediaUploadService.deleteBlobBestEffort(url, "album-photo", websiteId);
            throw ex;
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(weddingPhotoMapper.toResponse(photo));
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
        String oldUrl = weddingWebsiteService.currentHeroPhotoUrl(websiteId);
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
        String oldUrl = weddingWebsiteService.currentVenuePhotoUrl(websiteId);
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
        String oldUrl = weddingWebsiteService.currentStdImageUrl(websiteId);
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
        // Removing the save-the-date image must also delete its blob, otherwise the row is cleared
        // but the blob is orphaned in storage (issue #101). Capture the URL, clear it, then best-effort
        // delete after the clear is persisted.
        String oldUrl = weddingWebsiteService.currentStdImageUrl(websiteId);
        weddingWebsiteService.updateStdImage(websiteId, null);
        mediaUploadService.deleteBlobBestEffort(oldUrl, "std-remove", websiteId);
        return ResponseEntity.noContent().build();
    }
}
