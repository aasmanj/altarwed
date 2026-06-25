package com.altarwed.infrastructure.azure;

import com.altarwed.domain.exception.StorageNotConfiguredException;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
}
