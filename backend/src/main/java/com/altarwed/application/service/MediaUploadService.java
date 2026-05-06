package com.altarwed.application.service;

import com.altarwed.domain.port.BlobStoragePort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaUploadService {

    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_BYTES = 15 * 1024 * 1024; // 15 MB

    private final BlobStoragePort blobStorage;

    public MediaUploadService(BlobStoragePort blobStorage) {
        this.blobStorage = blobStorage;
    }

    public String uploadWeddingPartyPhoto(UUID memberId, MultipartFile file) throws IOException {
        validate(file);
        String ext = getExtension(file.getContentType());
        String blobName = "wedding-party/" + memberId + "/" + UUID.randomUUID() + ext;
        return blobStorage.upload(blobName, file.getInputStream(), file.getSize(), file.getContentType());
    }

    public String uploadHeroPhoto(UUID websiteId, MultipartFile file) throws IOException {
        validate(file);
        String ext = getExtension(file.getContentType());
        String blobName = "hero/" + websiteId + "/" + UUID.randomUUID() + ext;
        return blobStorage.upload(blobName, file.getInputStream(), file.getSize(), file.getContentType());
    }

    private void validate(MultipartFile file) {
        if (file.isEmpty()) throw new IllegalArgumentException("File is empty");
        if (!ALLOWED_TYPES.contains(file.getContentType()))
            throw new IllegalArgumentException("Only JPEG, PNG, and WebP images are allowed");
        if (file.getSize() > MAX_BYTES)
            throw new IllegalArgumentException("File must be under 15 MB");
    }

    private String getExtension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png"  -> ".png";
            case "image/webp" -> ".webp";
            default -> "";
        };
    }
}
