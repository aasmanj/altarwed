package com.altarwed.infrastructure.azure;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobProperties;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.io.ByteArrayInputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Integration test for the real Azure SDK upload path (issue #75) against Azurite, the official
 * Azure Storage emulator, via Testcontainers. The unit tests pin buildHeaders() in isolation;
 * this test proves the uploadWithResponse(BlobParallelUploadOptions) call actually persists the
 * Content-Type, Content-Disposition, and Cache-Control on the stored blob, that overwrite
 * semantics survived the switch from upload(data, length, true), and that a full-size (20 MB)
 * streamed upload works.
 *
 * Tagged "azurite" and excluded from the default test task (same pattern as schema-validation)
 * because it needs Docker. Run locally with: ./gradlew azuriteBlobTest
 */
@Tag("azurite")
class AzureBlobStorageAdapterAzuriteTest {

    // Azurite's fixed, publicly documented dev-account credentials (not a secret: this is the
    // well-known emulator key that ships in Microsoft's docs and every Azurite install).
    private static final String AZURITE_ACCOUNT = "devstoreaccount1";
    private static final String AZURITE_KEY =
            "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

    // --skipApiVersionCheck keeps the emulator compatible with SDK x-ms-versions newer than the
    // pinned image; pinning the image keeps the test reproducible.
    private static final GenericContainer<?> AZURITE =
            new GenericContainer<>(DockerImageName.parse("mcr.microsoft.com/azure-storage/azurite:3.31.0"))
                    .withExposedPorts(10000)
                    .withCommand("azurite-blob", "--blobHost", "0.0.0.0", "--skipApiVersionCheck")
                    .waitingFor(Wait.forListeningPort());

    private static String connectionString;
    private static AzureBlobStorageAdapter adapter;

    @BeforeAll
    static void startAzurite() {
        AZURITE.start();
        connectionString = String.format(
                "DefaultEndpointsProtocol=http;AccountName=%s;AccountKey=%s;BlobEndpoint=http://%s:%d/%s;",
                AZURITE_ACCOUNT, AZURITE_KEY, AZURITE.getHost(), AZURITE.getMappedPort(10000), AZURITE_ACCOUNT);
        adapter = new AzureBlobStorageAdapter(connectionString, "altarwed-media", "");
    }

    @AfterAll
    static void stopAzurite() {
        AZURITE.stop();
    }

    @Test
    void uploadPersistsContentTypeDispositionAndCacheControlOnTheStoredBlob() {
        byte[] bytes = "fake-png-bytes".getBytes();
        String blobName = "hero/11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000000.png";

        String url = adapter.upload(blobName, new ByteArrayInputStream(bytes), bytes.length, "image/png");

        assertTrue(url.contains("altarwed-media"), "returned URL should point into the container");
        BlobProperties props = propertiesOf(blobName);
        assertEquals("image/png", props.getContentType());
        assertEquals("inline; filename=\"aaaaaaaa-0000-0000-0000-000000000000.png\"",
                props.getContentDisposition());
        assertEquals("public, max-age=31536000, immutable", props.getCacheControl());
        assertEquals(bytes.length, props.getBlobSize());
    }

    // The previous code was upload(data, length, overwrite=true); the new
    // uploadWithResponse(options) call passes no request conditions, which must keep the
    // overwrite-allowed semantics (a replace flow re-using a name must not throw 409).
    @Test
    void uploadOverwritesAnExistingBlobLikeTheOldCodePath() {
        String blobName = "blocks/22222222-2222-2222-2222-222222222222/bbbbbbbb.png";
        byte[] first = new byte[]{1, 2, 3};
        byte[] second = new byte[]{9, 8, 7, 6};

        adapter.upload(blobName, new ByteArrayInputStream(first), first.length, "image/png");
        adapter.upload(blobName, new ByteArrayInputStream(second), second.length, "image/webp");

        BlobProperties props = propertiesOf(blobName);
        assertEquals(second.length, props.getBlobSize());
        assertEquals("image/webp", props.getContentType());
    }

    // A full-size upload (the 20 MB MediaUploadService cap) streams through the same options
    // path; asserts size and headers so a chunking/buffering regression cannot hide.
    @Test
    void uploadHandlesTheTwentyMegabyteCapSize() {
        byte[] big = new byte[20 * 1024 * 1024];
        String blobName = "wedding-photos/33333333-3333-3333-3333-333333333333/cccccccc.jpg";

        adapter.upload(blobName, new ByteArrayInputStream(big), big.length, "image/jpeg");

        BlobProperties props = propertiesOf(blobName);
        assertEquals(big.length, props.getBlobSize());
        assertEquals("image/jpeg", props.getContentType());
        assertEquals("inline; filename=\"cccccccc.jpg\"", props.getContentDisposition());
    }

    private static BlobProperties propertiesOf(String blobName) {
        BlobContainerClient verifier = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .buildClient()
                .getBlobContainerClient("altarwed-media");
        return verifier.getBlobClient(blobName).getProperties();
    }
}
