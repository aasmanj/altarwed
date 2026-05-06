package com.altarwed.web.controller;

import com.altarwed.application.service.MediaUploadService;
import com.altarwed.application.service.WeddingPartyMemberService;
import com.altarwed.application.service.WeddingWebsiteService;
import org.springframework.http.ResponseEntity;
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

    public MediaUploadController(
            MediaUploadService mediaUploadService,
            WeddingPartyMemberService weddingPartyMemberService,
            WeddingWebsiteService weddingWebsiteService
    ) {
        this.mediaUploadService = mediaUploadService;
        this.weddingPartyMemberService = weddingPartyMemberService;
        this.weddingWebsiteService = weddingWebsiteService;
    }

    @PostMapping("/wedding-party/{websiteId}/{memberId}/photo")
    public ResponseEntity<Map<String, String>> uploadMemberPhoto(
            @PathVariable UUID websiteId,
            @PathVariable UUID memberId,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        // Verify member belongs to website before uploading
        weddingPartyMemberService.getMemberForUpload(websiteId, memberId);
        String url = mediaUploadService.uploadWeddingPartyPhoto(memberId, file);
        // Patch the member's photoUrl
        weddingPartyMemberService.updatePhotoUrl(websiteId, memberId, url);
        return ResponseEntity.ok(Map.of("photoUrl", url));
    }

    @PostMapping("/wedding-websites/{websiteId}/hero")
    public ResponseEntity<Map<String, String>> uploadHeroPhoto(
            @PathVariable UUID websiteId,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        String url = mediaUploadService.uploadHeroPhoto(websiteId, file);
        weddingWebsiteService.updateHeroPhoto(websiteId, url);
        return ResponseEntity.ok(Map.of("photoUrl", url));
    }
}
