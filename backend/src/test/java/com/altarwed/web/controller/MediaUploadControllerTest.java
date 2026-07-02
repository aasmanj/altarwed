package com.altarwed.web.controller;

import com.altarwed.application.dto.AddWeddingPhotoRequest;
import com.altarwed.application.service.MediaUploadService;
import com.altarwed.application.service.WeddingPartyMemberService;
import com.altarwed.application.service.WeddingPhotoService;
import com.altarwed.application.service.WeddingWebsiteService;
import com.altarwed.domain.model.WeddingPhoto;
import com.altarwed.web.mapper.WeddingPhotoMapper;
import com.altarwed.web.security.CoupleAccessGuard;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for MediaUploadController.uploadWeddingPhoto() compensating blob cleanup (issue #150).
 *
 * The album upload writes the blob first, then inserts the wedding_photos row. If that insert fails
 * after a successful blob upload, the blob must be best-effort deleted so it is not orphaned in
 * storage forever. Controllers are plain classes, so this is a Mockito-only unit test (no Spring
 * context, no Docker). deleteBlobBestEffort is verified to fire on failure and to NOT fire on the
 * happy path (so a successful upload keeps its blob).
 */
class MediaUploadControllerTest {

    private final MediaUploadService mediaUploadService = mock(MediaUploadService.class);
    private final WeddingPartyMemberService weddingPartyMemberService = mock(WeddingPartyMemberService.class);
    private final WeddingWebsiteService weddingWebsiteService = mock(WeddingWebsiteService.class);
    private final WeddingPhotoService weddingPhotoService = mock(WeddingPhotoService.class);
    private final CoupleAccessGuard accessGuard = mock(CoupleAccessGuard.class);
    private final WeddingPhotoMapper weddingPhotoMapper = new WeddingPhotoMapper();

    private final MediaUploadController controller = new MediaUploadController(
            mediaUploadService,
            weddingPartyMemberService,
            weddingWebsiteService,
            weddingPhotoService,
            weddingPhotoMapper,
            accessGuard
    );

    private final UUID websiteId = UUID.randomUUID();
    private final String email = "owner@example.com";
    private final MultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[]{1, 2, 3});

    @Test
    void uploadWeddingPhoto_deletesBlobWhenDbInsertFails() throws IOException {
        String uploadedUrl = "https://blob.example.com/albums/" + websiteId + "/photo.jpg";
        when(mediaUploadService.uploadWeddingPhoto(eq(websiteId), any())).thenReturn(uploadedUrl);
        when(weddingPhotoService.addPhoto(eq(websiteId), any(AddWeddingPhotoRequest.class)))
                .thenThrow(new RuntimeException("db insert failed"));

        assertThatThrownBy(() -> controller.uploadWeddingPhoto(websiteId, file, "our first dance", 0, email))
                .isInstanceOf(RuntimeException.class);

        // The orphaned blob must be cleaned up, and the original failure must still propagate.
        verify(mediaUploadService).deleteBlobBestEffort(uploadedUrl, "album-photo", websiteId);
    }

    @Test
    void uploadWeddingPhoto_keepsBlobOnSuccess() throws IOException {
        String uploadedUrl = "https://blob.example.com/albums/" + websiteId + "/photo.jpg";
        when(mediaUploadService.uploadWeddingPhoto(eq(websiteId), any())).thenReturn(uploadedUrl);
        WeddingPhoto saved = new WeddingPhoto(
                UUID.randomUUID(), websiteId, uploadedUrl, "our first dance", 0,
                LocalDateTime.now(), null, null, null);
        when(weddingPhotoService.addPhoto(eq(websiteId), any(AddWeddingPhotoRequest.class))).thenReturn(saved);

        ResponseEntity<?> response = controller.uploadWeddingPhoto(websiteId, file, "our first dance", 0, email);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        // A successful insert keeps its blob; no compensating delete on the happy path.
        verify(mediaUploadService, never()).deleteBlobBestEffort(any(), any(), any());
    }
}
