package com.altarwed.application.service;

import com.altarwed.domain.port.BlobStoragePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaUploadService {

    private static final Logger log = LoggerFactory.getLogger(MediaUploadService.class);
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_BYTES = 15 * 1024 * 1024; // 15 MB

    // Image file signatures (magic bytes). We sniff the real type from the leading bytes rather
    // than trust the client-supplied multipart Content-Type, which an attacker fully controls and
    // can spoof (for example, send "image/png" with HTML/script bytes). Dependency-free on purpose:
    // the allowlist is a tiny, fixed set, so a magic-byte check is sufficient and avoids pulling in
    // a heavy parser such as Apache Tika.
    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_MAGIC = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] RIFF_MAGIC = {0x52, 0x49, 0x46, 0x46}; // "RIFF" at offset 0 (WebP container)
    private static final byte[] WEBP_MAGIC = {0x57, 0x45, 0x42, 0x50}; // "WEBP" at offset 8
    // Leading bytes to read for detection. WebP needs the first 12 ("RIFF"...."WEBP"); 16 is a small margin.
    private static final int SIGNATURE_PROBE_BYTES = 16;

    private final BlobStoragePort blobStorage;

    public MediaUploadService(BlobStoragePort blobStorage) {
        this.blobStorage = blobStorage;
    }

    public String uploadWeddingPartyPhoto(UUID memberId, MultipartFile file) throws IOException {
        String contentType = validate(file);
        String ext = getExtension(contentType);
        String blobName = "wedding-party/" + memberId + "/" + UUID.randomUUID() + ext;
        return blobStorage.upload(blobName, file.getInputStream(), file.getSize(), contentType);
    }

    public String uploadWeddingPhoto(UUID websiteId, MultipartFile file) throws IOException {
        String contentType = validate(file);
        String ext = getExtension(contentType);
        String blobName = "wedding-photos/" + websiteId + "/" + UUID.randomUUID() + ext;
        return blobStorage.upload(blobName, file.getInputStream(), file.getSize(), contentType);
    }

    // Generic block image: stored under blocks/{websiteId}/ so it's scoped to the
    // website but not tied to any specific table row (unlike WeddingPhoto or party photos).
    public String uploadBlockImage(UUID websiteId, MultipartFile file) throws IOException {
        String contentType = validate(file);
        String ext = getExtension(contentType);
        String blobName = "blocks/" + websiteId + "/" + UUID.randomUUID() + ext;
        return blobStorage.upload(blobName, file.getInputStream(), file.getSize(), contentType);
    }

    public String uploadHeroPhoto(UUID websiteId, MultipartFile file) throws IOException {
        String contentType = validate(file);
        String ext = getExtension(contentType);
        String blobName = "hero/" + websiteId + "/" + UUID.randomUUID() + ext;
        return blobStorage.upload(blobName, file.getInputStream(), file.getSize(), contentType);
    }

    public String uploadStdImage(UUID websiteId, MultipartFile file) throws IOException {
        String contentType = validate(file);
        String ext = getExtension(contentType);
        String blobName = "std-images/" + websiteId + "/" + UUID.randomUUID() + ext;
        log.info("submitting std image to blob storage, websiteId={}", websiteId);
        try {
            String url = blobStorage.upload(blobName, file.getInputStream(), file.getSize(), contentType);
            log.info("std image stored in blob, websiteId={}", websiteId);
            return url;
        } catch (Exception ex) {
            log.error("blob storage upload failed for std image, websiteId={}", websiteId, ex);
            throw ex;
        }
    }

    public String uploadVenuePhoto(UUID websiteId, MultipartFile file) throws IOException {
        String contentType = validate(file);
        String ext = getExtension(contentType);
        String blobName = "venue-photos/" + websiteId + "/" + UUID.randomUUID() + ext;
        log.info("submitting venue photo to blob storage, websiteId={}", websiteId);
        try {
            String url = blobStorage.upload(blobName, file.getInputStream(), file.getSize(), contentType);
            log.info("venue photo stored in blob, websiteId={}", websiteId);
            return url;
        } catch (Exception ex) {
            log.error("blob storage upload failed for venue photo, websiteId={}", websiteId, ex);
            throw ex;
        }
    }

    public String uploadVendorLogo(UUID vendorId, MultipartFile file) throws IOException {
        String contentType = validate(file);
        String ext = getExtension(contentType);
        String blobName = "vendor-logos/" + vendorId + "/" + UUID.randomUUID() + ext;
        log.info("submitting vendor logo to blob storage, vendorId={}", vendorId);
        try {
            String url = blobStorage.upload(blobName, file.getInputStream(), file.getSize(), contentType);
            log.info("vendor logo stored in blob, vendorId={}", vendorId);
            return url;
        } catch (Exception ex) {
            log.error("blob storage upload failed for vendor logo, vendorId={}", vendorId, ex);
            throw ex;
        }
    }

    public String uploadVendorPortfolioPhoto(UUID vendorId, MultipartFile file) throws IOException {
        String contentType = validate(file);
        String ext = getExtension(contentType);
        String blobName = "vendor-portfolio/" + vendorId + "/" + UUID.randomUUID() + ext;
        log.info("submitting vendor portfolio photo to blob storage, vendorId={}", vendorId);
        try {
            String url = blobStorage.upload(blobName, file.getInputStream(), file.getSize(), contentType);
            log.info("vendor portfolio photo stored in blob, vendorId={}", vendorId);
            return url;
        } catch (Exception ex) {
            log.error("blob storage upload failed for vendor portfolio photo, vendorId={}", vendorId, ex);
            throw ex;
        }
    }

    // Validates the upload and returns the content-type sniffed from the file's magic bytes. The
    // returned value (not file.getContentType(), which an attacker fully controls) is the type that
    // should drive the stored blob extension and metadata, so the bytes on disk and their declared
    // type always agree.
    private String validate(MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("File is empty");
        if (!ALLOWED_TYPES.contains(file.getContentType()))
            throw new IllegalArgumentException("Only JPEG, PNG, and WebP images are allowed");
        if (file.getSize() > MAX_BYTES)
            throw new IllegalArgumentException("File must be under 15 MB");
        // Defense in depth: the Content-Type checked above is attacker-controlled, so confirm the
        // actual bytes carry an allowed image signature. The allowlist stays the single source of
        // truth (a sniffed type not in ALLOWED_TYPES is still rejected), so adding a signature later
        // without adding it to ALLOWED_TYPES does not silently widen what is accepted.
        String sniffedType = sniffImageType(readHeader(file));
        if (sniffedType == null || !ALLOWED_TYPES.contains(sniffedType)) {
            log.warn("upload rejected, bytes do not match an allowed image signature, declaredContentType={}",
                    file.getContentType());
            throw new IllegalArgumentException("Only JPEG, PNG, and WebP images are allowed");
        }
        return sniffedType;
    }

    // Reads only the leading bytes needed for signature detection, not the whole file. MultipartFile
    // returns a fresh InputStream on each call, so this does not consume the stream that the upload
    // methods later pass to blob storage.
    private static byte[] readHeader(MultipartFile file) throws IOException {
        try (InputStream in = file.getInputStream()) {
            return in.readNBytes(SIGNATURE_PROBE_BYTES);
        }
    }

    // Returns the allowed MIME type whose magic bytes match the header, or null if none match.
    private static String sniffImageType(byte[] header) {
        if (matchesAt(header, 0, JPEG_MAGIC)) return "image/jpeg";
        if (matchesAt(header, 0, PNG_MAGIC)) return "image/png";
        if (matchesAt(header, 0, RIFF_MAGIC) && matchesAt(header, 8, WEBP_MAGIC)) return "image/webp";
        return null;
    }

    private static boolean matchesAt(byte[] data, int offset, byte[] signature) {
        if (data.length < offset + signature.length) return false;
        for (int i = 0; i < signature.length; i++) {
            if (data[offset + i] != signature[i]) return false;
        }
        return true;
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
