package com.altarwed.infrastructure.azure;

import com.altarwed.domain.exception.StorageNotConfiguredException;
import com.azure.storage.blob.models.BlobHttpHeaders;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AzureBlobStorageAdapterTest {

    // A blank AZURE_STORAGE_CONNECTION_STRING must NOT crash bean construction: that is the
    // 503-no-logs startup-crash class issue #43 eliminates. Construction must touch no Azure SDK.
    @Test
    void constructsWithoutTouchingAzureWhenConnectionStringBlank() {
        assertDoesNotThrow(() -> new AzureBlobStorageAdapter("", "altarwed-media", ""));
    }

    @Test
    void constructsWithoutTouchingAzureWhenConnectionStringNull() {
        assertDoesNotThrow(() -> new AzureBlobStorageAdapter(null, "altarwed-media", ""));
    }

    // The feature degrades at call time, not boot time: an actual upload against unconfigured
    // storage fails with a typed StorageNotConfiguredException, which GlobalExceptionHandler maps
    // to 503 (not the catch-all 500) so a known config gap never pages on-call as an ERROR.
    @Test
    void uploadFailsClearlyWhenStorageNotConfigured() {
        AzureBlobStorageAdapter adapter = new AzureBlobStorageAdapter("", "altarwed-media", "");

        assertThrows(StorageNotConfiguredException.class,
                () -> adapter.upload("photo.png", InputStream.nullInputStream(), 0L, "image/png"));
    }

    // Delete degrades the same way: a typed exception at call time, never a startup crash.
    @Test
    void deleteFailsClearlyWhenStorageNotConfigured() {
        AzureBlobStorageAdapter adapter = new AzureBlobStorageAdapter("", "altarwed-media", "");

        assertThrows(StorageNotConfiguredException.class,
                () -> adapter.delete("https://altarwedprodstorage.blob.core.windows.net/altarwed-media/photo.png"));
    }

    // --- Issue #75: per-blob response headers stored at write time ---

    // The stored Content-Type is exactly what the caller validated from magic bytes. The adapter
    // must not "normalize" or fall back; MediaUploadService is the single source of truth for it.
    @Test
    void buildHeadersStoresTheValidatedContentTypeVerbatim() {
        BlobHttpHeaders headers = AzureBlobStorageAdapter.buildHeaders(
                "hero/1b4e28ba-2fa1-11d2-883f-0016d3cca427/9f8b6c1a-0000-0000-0000-000000000001.webp",
                "image/webp");

        assertEquals("image/webp", headers.getContentType());
    }

    // inline (not attachment): media is served from a separate cookieless origin and rendered via
    // <img> and direct links; attachment would force-download guest-facing photos. The filename is
    // derived from the server-generated blob name, never from client input.
    @Test
    void buildHeadersSetsInlineDispositionWithBlobDerivedFilename() {
        BlobHttpHeaders headers = AzureBlobStorageAdapter.buildHeaders(
                "wedding-photos/1b4e28ba-2fa1-11d2-883f-0016d3cca427/abc123.jpg", "image/jpeg");

        assertEquals("inline; filename=\"abc123.jpg\"", headers.getContentDisposition());
    }

    // Blob URLs are write-once (fresh UUID per upload), so a year of immutable caching can never
    // serve a stale image and lets the CDN edge absorb repeat traffic.
    @Test
    void buildHeadersSetsImmutableCacheControl() {
        BlobHttpHeaders headers = AzureBlobStorageAdapter.buildHeaders("hero/x/y.png", "image/png");

        assertEquals("public, max-age=31536000, immutable", headers.getCacheControl());
    }

    // --- Issue #75: disposition filename sanitization (defense in depth) ---

    // CR/LF must never survive: a raw newline inside a header value is header injection
    // (response splitting) and lets an attacker append arbitrary headers to the media response.
    @Test
    void dispositionFilenameStripsCarriageReturnAndLineFeed() {
        assertEquals("evilSet-Cookiepwn1.png",
                AzureBlobStorageAdapter.dispositionFilename("evil\r\nSet-Cookie: pwn=1.png"));
    }

    // A double quote would close the quoted filename="..." string and let the remainder be parsed
    // as new Content-Disposition parameters.
    @Test
    void dispositionFilenameStripsDoubleQuotesAndSeparators() {
        assertEquals("a.pngfilenameevil.html",
                AzureBlobStorageAdapter.dispositionFilename("a.png\"; filename=\"evil.html"));
    }

    // Path bits: only the last segment is kept, and traversal dots cannot survive as a prefix, so
    // a "save as" can never be steered outside the user's download directory.
    @Test
    void dispositionFilenameKeepsOnlyTheLastPathSegment() {
        assertEquals("passwd", AzureBlobStorageAdapter.dispositionFilename("../../etc/passwd"));
        assertEquals("c.png", AzureBlobStorageAdapter.dispositionFilename("blocks/b/c.png"));
        assertEquals("d.jpg", AzureBlobStorageAdapter.dispositionFilename("a\\b\\d.jpg"));
    }

    @Test
    void dispositionFilenameStripsLeadingDots() {
        assertEquals("hidden.png", AzureBlobStorageAdapter.dispositionFilename("...hidden.png"));
    }

    // Non-ASCII and control characters are removed by the allowlist rather than escaped, keeping
    // the header a plain quoted-string with no RFC 5987 encoding needed.
    @Test
    void dispositionFilenameDropsNonAsciiAndControlCharacters() {
        assertEquals("photo.jpg", AzureBlobStorageAdapter.dispositionFilename("phöoto .jpg"));
    }

    // A name that sanitizes to nothing falls back to a harmless constant instead of emitting
    // filename="" (which some browsers render inconsistently).
    @Test
    void dispositionFilenameFallsBackWhenNothingSurvives() {
        assertEquals("download", AzureBlobStorageAdapter.dispositionFilename("\"\r\n/../"));
        assertEquals("download", AzureBlobStorageAdapter.dispositionFilename(null));
    }

    // Truncation keeps the tail so the extension survives; length is bounded to 100 chars.
    @Test
    void dispositionFilenameTruncatesFromTheFrontKeepingExtension() {
        String longName = "a".repeat(150) + ".png";
        String result = AzureBlobStorageAdapter.dispositionFilename(longName);

        assertEquals(100, result.length());
        assertTrue(result.endsWith(".png"));
    }
}
