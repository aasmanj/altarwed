package com.altarwed.application.service;

import com.altarwed.domain.port.BlobStoragePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaUploadService {

    private static final Logger log = LoggerFactory.getLogger(MediaUploadService.class);
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

    public String uploadWeddingPhoto(UUID websiteId, MultipartFile file) throws IOException {
        validate(file);
        String ext = getExtension(file.getContentType());
        String blobName = "wedding-photos/" + websiteId + "/" + UUID.randomUUID() + ext;
        return blobStorage.upload(blobName, file.getInputStream(), file.getSize(), file.getContentType());
    }

    // Generic block image: stored under blocks/{websiteId}/ so it's scoped to the
    // website but not tied to any specific table row (unlike WeddingPhoto or party photos).
    public String uploadBlockImage(UUID websiteId, MultipartFile file) throws IOException {
        validate(file);
        String ext = getExtension(file.getContentType());
        String blobName = "blocks/" + websiteId + "/" + UUID.randomUUID() + ext;
        return blobStorage.upload(blobName, file.getInputStream(), file.getSize(), file.getContentType());
    }

    public String uploadHeroPhoto(UUID websiteId, MultipartFile file) throws IOException {
        validate(file);
        String ext = getExtension(file.getContentType());
        String blobName = "hero/" + websiteId + "/" + UUID.randomUUID() + ext;
        return blobStorage.upload(blobName, file.getInputStream(), file.getSize(), file.getContentType());
    }

    public String uploadVenuePhoto(UUID websiteId, MultipartFile file) throws IOException {
        validate(file);
        String ext = getExtension(file.getContentType());
        String blobName = "venue-photos/" + websiteId + "/" + UUID.randomUUID() + ext;
        log.info("submitting venue photo to blob storage, websiteId={}", websiteId);
        try {
            String url = blobStorage.upload(blobName, file.getInputStream(), file.getSize(), file.getContentType());
            log.info("venue photo stored in blob, websiteId={}", websiteId);
            return url;
        } catch (Exception ex) {
            log.error("blob storage upload failed for venue photo, websiteId={}", websiteId, ex);
            throw ex;
        }
    }

    public String uploadVendorLogo(UUID vendorId, MultipartFile file) throws IOException {
        validate(file);
        String ext = getExtension(file.getContentType());
        String blobName = "vendor-logos/" + vendorId + "/" + UUID.randomUUID() + ext;
        log.info("submitting vendor logo to blob storage, vendorId={}", vendorId);
        try {
            String url = blobStorage.upload(blobName, file.getInputStream(), file.getSize(), file.getContentType());
            log.info("vendor logo stored in blob, vendorId={}", vendorId);
            return url;
        } catch (Exception ex) {
            log.error("blob storage upload failed for vendor logo, vendorId={}", vendorId, ex);
            throw ex;
        }
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
