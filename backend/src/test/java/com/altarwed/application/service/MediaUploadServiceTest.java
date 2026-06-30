package com.altarwed.application.service;

import com.altarwed.domain.port.BlobStoragePort;
import com.altarwed.domain.port.WeddingWebsiteRepository;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.zip.CRC32;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for MediaUploadService.validate(). validate() trusts the real bytes (magic-number
 * sniffing), not the client-supplied multipart Content-Type, and additionally enforces the upload
 * pipeline hardening from the backlog:
 *  - the declared Content-Type must equal the sniffed type (issue #87),
 *  - the decoded megapixels are capped to reject pixel-flood images (issue #98),
 *  - a single 20 MB size limit (issue #93).
 * Mockito only, no Spring context, no Docker.
 */
class MediaUploadServiceTest {

    private final BlobStoragePort blobStorage = mock(BlobStoragePort.class);
    private final WeddingWebsiteRepository websiteRepository = mock(WeddingWebsiteRepository.class);
    private final MediaUploadService service = new MediaUploadService(blobStorage, websiteRepository);
    private final UUID id = UUID.randomUUID();

    // --- Real image signatures (leading magic bytes), padded so each file is non-empty. ---

    private static byte[] pngBytes() {
        return concat(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, filler());
    }

    private static byte[] jpegBytes() {
        return concat(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}, filler());
    }

    private static byte[] webpBytes() {
        // "RIFF" (4) + 4-byte length placeholder + "WEBP" (4)
        return concat(new byte[]{0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50}, filler());
    }

    private static byte[] filler() {
        return new byte[]{0, 1, 2, 3, 4, 5, 6, 7};
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] out = new byte[a.length + b.length];
        System.arraycopy(a, 0, out, 0, a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }

    // Builds a structurally valid PNG header (signature + IHDR + IEND, correct CRCs) declaring a
    // width x height canvas. ImageIO reads dimensions from IHDR WITHOUT rasterizing, so a giant
    // canvas costs ~45 bytes and never allocates pixels. This is exactly the pixel-flood shape that
    // issue #98 must reject, and lets the cap be tested without generating a real huge image.
    private static byte[] pngWithDeclaredSize(int width, int height) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
        byte[] ihdr = new byte[13];
        writeBigEndianInt(ihdr, 0, width);
        writeBigEndianInt(ihdr, 4, height);
        ihdr[8] = 8;  // bit depth
        ihdr[9] = 2;  // color type: truecolor RGB
        ihdr[10] = 0; // compression
        ihdr[11] = 0; // filter
        ihdr[12] = 0; // interlace
        writeChunk(out, "IHDR", ihdr);
        writeChunk(out, "IEND", new byte[0]);
        return out.toByteArray();
    }

    private static void writeChunk(ByteArrayOutputStream out, String type, byte[] data) {
        byte[] length = new byte[4];
        writeBigEndianInt(length, 0, data.length);
        out.writeBytes(length);
        byte[] typeBytes = type.getBytes(StandardCharsets.US_ASCII);
        out.writeBytes(typeBytes);
        out.writeBytes(data);
        CRC32 crc = new CRC32();
        crc.update(typeBytes);
        crc.update(data);
        byte[] crcBytes = new byte[4];
        writeBigEndianInt(crcBytes, 0, (int) crc.getValue());
        out.writeBytes(crcBytes);
    }

    private static void writeBigEndianInt(byte[] buf, int offset, int value) {
        buf[offset] = (byte) (value >>> 24);
        buf[offset + 1] = (byte) (value >>> 16);
        buf[offset + 2] = (byte) (value >>> 8);
        buf[offset + 3] = (byte) value;
    }

    // --- Byte sniffing trumps the declared Content-Type (existing behavior) ---

    @Test
    void rejects_html_bytes_disguised_as_png() {
        // Declares image/png but carries HTML/script bytes. The old header-only check accepted this.
        byte[] html = "<!DOCTYPE html><script>alert(1)</script>".getBytes(StandardCharsets.UTF_8);
        MultipartFile file = new MockMultipartFile("file", "evil.png", "image/png", html);

        assertThatThrownBy(() -> service.uploadWeddingPartyPhoto(id, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JPEG, PNG, and WebP");

        verifyNoUpload();
    }

    @Test
    void rejects_non_image_bytes_even_when_header_claims_png() {
        // A real (non-image) PDF signature with a spoofed image/png header is still rejected by sniffing.
        byte[] pdf = concat("%PDF-1.7".getBytes(StandardCharsets.UTF_8), filler());
        MultipartFile file = new MockMultipartFile("file", "doc.png", "image/png", pdf);

        assertThatThrownBy(() -> service.uploadWeddingPhoto(id, file))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoUpload();
    }

    @Test
    void accepts_real_png() throws IOException {
        when(blobStorage.upload(any(), any(), anyLong(), any())).thenReturn("https://blob/x.png");
        MultipartFile file = new MockMultipartFile("file", "real.png", "image/png", pngBytes());

        String url = service.uploadWeddingPartyPhoto(id, file);

        assertThat(url).isEqualTo("https://blob/x.png");
        verify(blobStorage).upload(any(), any(), anyLong(), any());
    }

    @Test
    void accepts_real_jpeg() throws IOException {
        when(blobStorage.upload(any(), any(), anyLong(), any())).thenReturn("https://blob/x.jpg");
        MultipartFile file = new MockMultipartFile("file", "real.jpg", "image/jpeg", jpegBytes());

        assertThat(service.uploadHeroPhoto(id, file)).isEqualTo("https://blob/x.jpg");
        verify(blobStorage).upload(any(), any(), anyLong(), any());
    }

    @Test
    void accepts_real_webp() throws IOException {
        when(blobStorage.upload(any(), any(), anyLong(), any())).thenReturn("https://blob/x.webp");
        MultipartFile file = new MockMultipartFile("file", "real.webp", "image/webp", webpBytes());

        assertThat(service.uploadBlockImage(id, file)).isEqualTo("https://blob/x.webp");
        verify(blobStorage).upload(any(), any(), anyLong(), any());
    }

    // --- Issue #87: declared Content-Type must equal the sniffed type ---

    @Test
    void rejects_png_bytes_declared_as_jpeg_even_though_both_are_allowed() {
        // Real PNG bytes declared image/jpeg. Both types are on the allowlist, so the old contract
        // let this dishonest upload through (this is the inverse of the removed
        // stores_blob..._not_declared_header test, which relied on the mismatch passing). After #87
        // the declared type must equal the sniffed type, so it is rejected with the same opaque
        // message (no detected-type detail leaked back to the caller).
        MultipartFile file = new MockMultipartFile("file", "mismatch.jpg", "image/jpeg", pngBytes());

        assertThatThrownBy(() -> service.uploadVenuePhoto(id, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JPEG, PNG, and WebP");

        verifyNoUpload();
    }

    @Test
    void rejects_jpeg_bytes_declared_as_png() {
        // The mismatch is rejected in both directions, not just PNG-as-JPEG.
        MultipartFile file = new MockMultipartFile("file", "mismatch.png", "image/png", jpegBytes());

        assertThatThrownBy(() -> service.uploadVenuePhoto(id, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JPEG, PNG, and WebP");

        verifyNoUpload();
    }

    @Test
    void accepts_honest_jpeg_declared_as_jpeg() throws IOException {
        // The honest upload (JPEG bytes declared image/jpeg) is unaffected by the #87 match check.
        when(blobStorage.upload(any(), any(), anyLong(), any())).thenReturn("https://blob/honest.jpg");
        MultipartFile file = new MockMultipartFile("file", "honest.jpg", "image/jpeg", jpegBytes());

        assertThat(service.uploadWeddingPhoto(id, file)).isEqualTo("https://blob/honest.jpg");
        verify(blobStorage).upload(any(), any(), anyLong(), any());
    }

    // --- Issue #98: pixel-flood / megapixel cap ---

    @Test
    void rejects_pixel_flood_image_over_megapixel_cap() {
        // A ~45-byte PNG whose IHDR declares a 12000 x 12000 (144 MP) canvas, far over the 40 MP cap.
        // The bytes are honest (real PNG signature, declared image/png), so the upload clears the
        // type checks and reaches the dimension cap, where it is rejected before any blob is stored.
        byte[] huge = pngWithDeclaredSize(12_000, 12_000);
        MultipartFile file = new MockMultipartFile("file", "bomb.png", "image/png", huge);

        assertThatThrownBy(() -> service.uploadWeddingPhoto(id, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dimensions");

        verifyNoUpload();
    }

    @Test
    void accepts_real_png_with_dimensions_under_cap() throws IOException {
        // A header-readable PNG with sane dimensions passes the megapixel cap, so the #98 check does
        // not reject normal photos (regression guard).
        when(blobStorage.upload(any(), any(), anyLong(), any())).thenReturn("https://blob/ok.png");
        byte[] ok = pngWithDeclaredSize(800, 600); // 0.48 MP, well under the 40 MP cap
        MultipartFile file = new MockMultipartFile("file", "ok.png", "image/png", ok);

        assertThat(service.uploadWeddingPhoto(id, file)).isEqualTo("https://blob/ok.png");
        verify(blobStorage).upload(any(), any(), anyLong(), any());
    }

    // --- Issue #93: single 20 MB limit ---

    @Test
    void rejects_file_over_20_mb_with_20_mb_message() {
        // 20 MB + 1 byte, declared image/jpeg. The size gate runs before sniffing, so any oversize
        // content trips it. Before #93 the limit and message were 15 MB; this asserts the new 20 MB.
        byte[] oversize = new byte[20 * 1024 * 1024 + 1];
        MultipartFile file = new MockMultipartFile("file", "huge.jpg", "image/jpeg", oversize);

        assertThatThrownBy(() -> service.uploadWeddingPhoto(id, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("20 MB");

        verifyNoUpload();
    }

    @Test
    void accepts_16_mb_file_that_the_old_15_mb_limit_rejected() throws IOException {
        // A 16 MB honest JPEG: above the old 15 MB cap (would have thrown "under 15 MB") and below
        // the unified 20 MB cap, so it now succeeds. Proves the limit was actually raised (#93).
        when(blobStorage.upload(any(), any(), anyLong(), any())).thenReturn("https://blob/big.jpg");
        byte[] sixteenMb = concat(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0},
                new byte[16 * 1024 * 1024]);
        MultipartFile file = new MockMultipartFile("file", "big.jpg", "image/jpeg", sixteenMb);

        assertThat(service.uploadWeddingPhoto(id, file)).isEqualTo("https://blob/big.jpg");
        verify(blobStorage).upload(any(), any(), anyLong(), any());
    }

    // --- Issue #101: best-effort orphan-blob cleanup helper ---

    @Test
    void deleteBlobBestEffort_is_a_noop_for_null_or_blank_url() {
        service.deleteBlobBestEffort(null, "hero for websiteId=" + id);
        service.deleteBlobBestEffort("   ", "hero for websiteId=" + id);

        verify(blobStorage, never()).delete(any());
    }

    @Test
    void deleteBlobBestEffort_swallows_storage_failure() {
        doThrow(new RuntimeException("azure unavailable")).when(blobStorage).delete(any());

        // Must not propagate: a failed cleanup never fails the caller's already-persisted request.
        service.deleteBlobBestEffort("https://blob/old-hero.png", "hero for websiteId=" + id);

        verify(blobStorage).delete("https://blob/old-hero.png");
    }

    // --- Existing guards preserved ---

    @Test
    void still_rejects_disallowed_declared_type_up_front() {
        // A declared type not on the allowlist is rejected before sniffing. GIF is not on the
        // allowlist, even with real GIF bytes.
        byte[] gif = concat(new byte[]{0x47, 0x49, 0x46, 0x38, 0x39, 0x61}, filler());
        MultipartFile file = new MockMultipartFile("file", "anim.gif", "image/gif", gif);

        assertThatThrownBy(() -> service.uploadWeddingPhoto(id, file))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoUpload();
    }

    @Test
    void still_rejects_empty_file() {
        MultipartFile file = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> service.uploadWeddingPhoto(id, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("empty");

        verifyNoUpload();
    }

    private void verifyNoUpload() {
        verify(blobStorage, never()).upload(any(), any(), anyLong(), any());
    }
}
