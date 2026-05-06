package com.altarwed.web.controller;

import com.altarwed.application.dto.AddWeddingPhotoRequest;
import com.altarwed.application.dto.WeddingPhotoResponse;
import com.altarwed.application.service.MediaUploadService;
import com.altarwed.application.service.WeddingPartyMemberService;
import com.altarwed.application.service.WeddingPhotoService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.web.mapper.WeddingPhotoMapper;
import org.springframework.http.HttpStatus;
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
    private final WeddingPhotoService weddingPhotoService;
    private final WeddingPhotoMapper weddingPhotoMapper;

    public MediaUploadController(
            MediaUploadService mediaUploadService,
            WeddingPartyMemberService weddingPartyMemberService,
            WeddingWebsiteService weddingWebsiteService,
            WeddingPhotoService weddingPhotoService,
            WeddingPhotoMapper weddingPhotoMapper
    ) {
        this.mediaUploadService = mediaUploadService;
        this.weddingPartyMemberService = weddingPartyMemberService;
        this.weddingWebsiteService = weddingWebsiteService;
        this.weddingPhotoService = weddingPhotoService;
        this.weddingPhotoMapper = weddingPhotoMapper;
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

    // Upload a photo and register it in the wedding_photos table — returns the full WeddingPhotoResponse
    @PostMapping("/wedding-websites/{websiteId}/photos")
    public ResponseEntity<WeddingPhotoResponse> uploadWeddingPhoto(
            @PathVariable UUID websiteId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "caption", required = false) String caption,
            @RequestParam(value = "sortOrder", required = false) Integer sortOrder
    ) throws IOException {
        String url = mediaUploadService.uploadWeddingPhoto(websiteId, file);
        AddWeddingPhotoRequest req = new AddWeddingPhotoRequest(url, caption, sortOrder);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(weddingPhotoMapper.toResponse(weddingPhotoService.addPhoto(websiteId, req)));
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
