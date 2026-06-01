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
        String url = mediaUploadService.uploadHeroPhoto(websiteId, file);
        weddingWebsiteService.updateHeroPhoto(websiteId, url);
        return ResponseEntity.ok(Map.of("photoUrl", url));
    }
}
