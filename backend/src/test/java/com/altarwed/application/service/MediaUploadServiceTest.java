package com.altarwed.application.service;

import com.altarwed.domain.exception.FileTooLargeException;
import com.altarwed.domain.exception.UnsupportedImageTypeException;
import com.altarwed.domain.port.BlobStoragePort;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifies that validate() trusts the real bytes (magic-number sniffing), not the client-supplied
 * multipart Content-Type. The reject cases below pass under the new logic and would have failed
 * under the old header-only check, which accepted anything whose declared type was on the allowlist.
 */
class MediaUploadServiceTest {

    private final BlobStoragePort blobStorage = mock(BlobStoragePort.class);
    private final MediaUploadService service = new MediaUploadService(blobStorage);
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

    @Test
    void rejects_html_bytes_disguised_as_png() {
        // Declares image/png but carries HTML/script bytes. The old header-only check accepted this.
        byte[] html = "<!DOCTYPE html><script>alert(1)</script>".getBytes(StandardCharsets.UTF_8);
        MultipartFile file = new MockMultipartFile("file", "evil.png", "image/png", html);

        assertThatThrownBy(() -> service.uploadWeddingPartyPhoto(id, file))
                .isInstanceOf(UnsupportedImageTypeException.class)
                .hasMessageContaining("JPEG, PNG, and WebP");

        verifyNoUpload();
    }

    @Test
    void rejects_non_image_bytes_even_when_header_claims_png() {
        // Proves the client Content-Type alone can no longer smuggle a file in: a real (non-image)
        // PDF signature with a spoofed image/png header is still rejected by byte sniffing.
        byte[] pdf = concat("%PDF-1.7".getBytes(StandardCharsets.UTF_8), filler());
        MultipartFile file = new MockMultipartFile("file", "doc.png", "image/png", pdf);

        assertThatThrownBy(() -> service.uploadWeddingPhoto(id, file))
                .isInstanceOf(UnsupportedImageTypeException.class);

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

    @Test
    void sniffed_type_must_also_match_declared_allowlist_so_a_real_png_under_a_jpeg_header_passes() throws IOException {
        // The bytes are a real PNG; the declared header is image/jpeg (both on the allowlist).
        // The current contract only requires the sniffed type to be on the allowlist, so this passes.
        when(blobStorage.upload(any(), any(), anyLong(), any())).thenReturn("https://blob/x.bin");
        MultipartFile file = new MockMultipartFile("file", "mismatch.jpg", "image/jpeg", pngBytes());

        assertThat(service.uploadVenuePhoto(id, file)).isEqualTo("https://blob/x.bin");
    }

    @Test
    void stores_blob_extension_and_metadata_from_sniffed_type_not_declared_header() throws IOException {
        // A real PNG declared as image/jpeg (both on the allowlist). The stored blob name and the
        // content-type metadata must follow the sniffed bytes (image/png -> .png), not the attacker
        // controlled header (image/jpeg -> .jpg). Before threading sniffedType out of validate(),
        // both used file.getContentType() and this asserted .png/image/png would have failed.
        when(blobStorage.upload(any(), any(), anyLong(), eq("image/png"))).thenReturn("https://blob/x.png");
        MultipartFile file = new MockMultipartFile("file", "mismatch.jpg", "image/jpeg", pngBytes());

        service.uploadVenuePhoto(id, file);

        ArgumentCaptor<String> blobName = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> contentType = ArgumentCaptor.forClass(String.class);
        verify(blobStorage).upload(blobName.capture(), any(InputStream.class), anyLong(), contentType.capture());
        assertThat(blobName.getValue()).endsWith(".png");
        assertThat(contentType.getValue()).isEqualTo("image/png");
    }

    @Test
    void still_rejects_disallowed_declared_type_up_front() {
        // Existing behavior preserved: a declared type that is not on the allowlist is rejected
        // before sniffing. GIF is intentionally not on the allowlist, even with real GIF bytes.
        byte[] gif = concat(new byte[]{0x47, 0x49, 0x46, 0x38, 0x39, 0x61}, filler());
        MultipartFile file = new MockMultipartFile("file", "anim.gif", "image/gif", gif);

        assertThatThrownBy(() -> service.uploadWeddingPhoto(id, file))
                .isInstanceOf(UnsupportedImageTypeException.class);

        verifyNoUpload();
    }

    @Test
    void rejects_a_file_over_the_20_mb_limit_with_file_too_large() {
        // Issue #93: the limit is 20 MB (was 15). A 21 MB PNG (valid magic bytes so it would pass the
        // type/signature checks) must be rejected on size alone, and as a FileTooLargeException so the
        // web layer maps it to 413 rather than the old generic 400.
        byte[] oversize = concat(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
                new byte[21 * 1024 * 1024]);
        MultipartFile file = new MockMultipartFile("file", "huge.png", "image/png", oversize);

        assertThatThrownBy(() -> service.uploadWeddingPhoto(id, file))
                .isInstanceOf(FileTooLargeException.class)
                .hasMessageContaining("20 MB");

        verifyNoUpload();
    }

    @Test
    void accepts_a_file_just_under_the_20_mb_limit() throws IOException {
        // A ~19 MB PNG (under the new 20 MB cap) that would have been rejected under the old 15 MB
        // limit now uploads. Asserts the limit really moved, not just the message.
        when(blobStorage.upload(any(), any(), anyLong(), any())).thenReturn("https://blob/big.png");
        byte[] underLimit = concat(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
                new byte[19 * 1024 * 1024]);
        MultipartFile file = new MockMultipartFile("file", "big.png", "image/png", underLimit);

        assertThat(service.uploadWeddingPhoto(id, file)).isEqualTo("https://blob/big.png");
        verify(blobStorage).upload(any(), any(), anyLong(), any());
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
