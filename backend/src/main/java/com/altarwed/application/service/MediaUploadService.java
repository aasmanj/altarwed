package com.altarwed.application.service;

import com.altarwed.domain.model.WeddingWebsite;
import com.altarwed.domain.port.BlobStoragePort;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaUploadService {

    private static final Logger log = LoggerFactory.getLogger(MediaUploadService.class);
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    // One upload limit, matched to spring.servlet.multipart.max-file-size (20MB) in application.yml
    // and the frontend client checks, so a file that clears the client and multipart layers is not
    // then rejected here with a contradictory number (issue #93). Phone photos are routinely 10-25 MB.
    private static final long MAX_BYTES = 20 * 1024 * 1024; // 20 MB
    // Pixel-flood / decompression-bomb cap (issue #98). A tiny file can declare an enormous canvas;
    // the public site's image optimizer would rasterize it per guest and exhaust memory on the
    // shared SSR server. 40 MP sits well above any real phone or DSLR photo, so honest uploads pass.
    private static final long MAX_MEGAPIXELS = 40;

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
    // Read-only access to the website row so a replace can capture the prior hero/venue/std blob URL
    // for best-effort cleanup (issue #101). Injecting the WeddingWebsiteRepository domain port into
    // this application service (application -> domain is allowed) keeps the controller from calling a
    // repository directly, honoring the web -> application -> domain rule.
    private final WeddingWebsiteRepository websiteRepository;

    public MediaUploadService(BlobStoragePort blobStorage, WeddingWebsiteRepository websiteRepository) {
        this.blobStorage = blobStorage;
        this.websiteRepository = websiteRepository;
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

    // Deletes a blob that a replace operation orphaned (issue #101). Best-effort: it never throws, so
    // a failed cleanup leaves a logged, recoverable orphan rather than failing a request whose new URL
    // has already been persisted. context is a non-PII label (field name + internal websiteId) so the
    // WARN is actionable without leaking guest data. Callers must invoke this AFTER the new URL is
    // saved, so a delete never runs for a blob the request still depends on.
    public void deleteBlobBestEffort(String url, String context) {
        if (url == null || url.isBlank()) return;
        try {
            blobStorage.delete(url);
            log.info("old blob deleted, context={}", context);
        } catch (Exception ex) {
            log.warn("old blob delete failed (best-effort, ignoring), context={}", context, ex);
        }
    }

    // The three readers below let MediaUploadController capture the URL of the blob a hero/venue/std
    // replace is about to overwrite, then delete it via deleteBlobBestEffort once the new URL is
    // persisted (issue #101). MediaUploadService already owns the hero/venue/std upload paths, so
    // reading the current URL for those same fields keeps the cleanup cohesive here and keeps the
    // controller from touching a repository directly. Returns null when the website or field is unset,
    // which deleteBlobBestEffort treats as a no-op.
    public String currentHeroPhotoUrl(UUID websiteId) {
        return websiteRepository.findById(websiteId).map(WeddingWebsite::heroPhotoUrl).orElse(null);
    }

    public String currentVenuePhotoUrl(UUID websiteId) {
        return websiteRepository.findById(websiteId).map(WeddingWebsite::venuePhotoUrl).orElse(null);
    }

    public String currentStdImageUrl(UUID websiteId) {
        return websiteRepository.findById(websiteId).map(WeddingWebsite::stdImageUrl).orElse(null);
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
            throw new IllegalArgumentException("File must be under 20 MB");
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
        // Issue #87: the declared Content-Type must equal the sniffed type. Both being on the
        // allowlist is not enough; PNG bytes declared as image/jpeg is a dishonest upload. Same
        // opaque message as the checks above so we never leak the detected type back to the caller.
        if (!sniffedType.equals(file.getContentType())) {
            log.warn("upload rejected, declared content-type does not match sniffed bytes, declaredContentType={}",
                    file.getContentType());
            throw new IllegalArgumentException("Only JPEG, PNG, and WebP images are allowed");
        }
        // Issue #98: reject a pixel-flood / decompression-bomb canvas before it can be stored.
        rejectIfPixelFlood(file);
        return sniffedType;
    }

    // Reads the image dimensions from the header via an ImageReader WITHOUT decoding (rasterizing)
    // the pixels, then caps total megapixels. A small file can declare a huge canvas; rasterizing it
    // on the shared SSR image optimizer would exhaust memory for every guest who loads the page.
    // Best-effort by design: if ImageIO cannot read the dimensions we let the upload through, because
    // the magic-byte and size checks above are the authoritative gates and we must not reject a valid
    // image just because the header was unreadable here.
    private void rejectIfPixelFlood(MultipartFile file) {
        try {
            try (ImageInputStream imageStream = ImageIO.createImageInputStream(file.getInputStream())) {
                if (imageStream == null) return;
                Iterator<ImageReader> readers = ImageIO.getImageReaders(imageStream);
                if (!readers.hasNext()) return;
                ImageReader reader = readers.next();
                try {
                    reader.setInput(imageStream, true, true);
                    long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                    if (pixels > MAX_MEGAPIXELS * 1_000_000L) {
                        log.warn("upload rejected, image dimensions exceed cap, megapixels={}",
                                pixels / 1_000_000L);
                        throw new IllegalArgumentException("Image dimensions are too large");
                    }
                } finally {
                    reader.dispose();
                }
            }
        } catch (IllegalArgumentException e) {
            throw e; // our own validation rejection above, propagate it to the caller (HTTP 400)
        } catch (Exception ignored) {
            // Dimension read is best-effort; an unreadable header falls through to allow the upload.
        }
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
