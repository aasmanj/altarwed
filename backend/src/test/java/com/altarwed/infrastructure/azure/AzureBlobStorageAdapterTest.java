package com.altarwed.infrastructure.azure;

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
    // storage fails with a clear IllegalStateException.
    @Test
    void uploadFailsClearlyWhenStorageNotConfigured() {
        AzureBlobStorageAdapter adapter = new AzureBlobStorageAdapter("", "altarwed-media", "");

        assertThrows(IllegalStateException.class,
                () -> adapter.upload("photo.png", InputStream.nullInputStream(), 0L, "image/png"));
    }
}
