package com.altarwed.infrastructure.azure;

import com.altarwed.domain.port.BlobStoragePort;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.models.BlobStorageException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;

@Component
public class AzureBlobStorageAdapter implements BlobStoragePort {

    private static final Logger log = LoggerFactory.getLogger(AzureBlobStorageAdapter.class);

    private final String connectionString;
    private final String containerName;
    // Optional CDN/custom-domain prefix (e.g. https://media.altarwed.com).
    // When set, returned blob URLs use this origin instead of the Azure storage hostname,
    // so email image URLs share the altarwed.com domain and don't trigger spam filters.
    private final String publicBaseUrl;

    // Built lazily on first use, NOT in the constructor. The Azure SDK throws synchronously on a
    // blank connection string and makes a network call to ensure the container exists; doing either
    // in the constructor would turn a missing/unreachable AZURE_STORAGE_CONNECTION_STRING into a
    // BeanCreationException that crashes the context before the health endpoint exists (the
    // 503-no-logs class in backend/CLAUDE.md). Deferring it lets the app boot healthy and fail only
    // the actual upload/delete call when storage is unconfigured. Double-checked locking on a
    // volatile field keeps the one-time build thread-safe.
    private volatile BlobContainerClient containerClient;

    public AzureBlobStorageAdapter(
            @Value("${altarwed.azure.storage.connection-string:}") String connectionString,
            @Value("${altarwed.azure.storage.container-name:altarwed-media}") String containerName,
            @Value("${altarwed.azure.storage.public-base-url:}") String publicBaseUrl
    ) {
        this.connectionString = connectionString;
        this.containerName = containerName;
        this.publicBaseUrl = publicBaseUrl == null ? "" : publicBaseUrl.stripTrailing().replaceAll("/+$", "");
        if (this.publicBaseUrl.isBlank()) {
            log.info("BLOB_PUBLIC_BASE_URL not set; blob image URLs use Azure storage hostname (set to CDN domain for email deliverability)");
        }
    }

    private BlobContainerClient container() {
        BlobContainerClient client = this.containerClient;
        if (client == null) {
            synchronized (this) {
                client = this.containerClient;
                if (client == null) {
                    if (connectionString == null || connectionString.isBlank()) {
                        throw new IllegalStateException(
                                "Azure storage is not configured (AZURE_STORAGE_CONNECTION_STRING is blank); media upload is disabled");
                    }
                    BlobServiceClient serviceClient = new BlobServiceClientBuilder()
                            .connectionString(connectionString)
                            .buildClient();
                    BlobContainerClient c = serviceClient.getBlobContainerClient(containerName);
                    // Idempotent and race-safe (vs exists()+create(), which has a TOCTOU window).
                    c.createIfNotExists();
                    this.containerClient = client = c;
                }
            }
        }
        return client;
    }

    @Override
    public String upload(String blobName, InputStream data, long length, String contentType) {
        log.info("blob upload started, blobName={}, sizeBytes={}, contentType={}", blobName, length, contentType);
        try {
            var blobClient = container().getBlobClient(blobName);
            var headers = new BlobHttpHeaders().setContentType(contentType);
            blobClient.upload(data, length, true);
            blobClient.setHttpHeaders(headers);
            log.info("blob upload succeeded, blobName={}", blobName);
            String blobUrl = blobClient.getBlobUrl();
            if (!publicBaseUrl.isBlank()) {
                // Replace the Azure storage origin (https://{account}.blob.core.windows.net)
                // with the CDN/custom-domain origin, preserving the full path.
                int pathStart = blobUrl.indexOf('/', 8); // skip past "https://"
                blobUrl = publicBaseUrl + blobUrl.substring(pathStart);
            }
            return blobUrl;
        } catch (BlobStorageException ex) {
            log.error("blob upload failed, blobName={}, statusCode={}", blobName, ex.getStatusCode(), ex);
            throw ex;
        }
    }

    @Override
    public void delete(String blobUrl) {
        BlobContainerClient container = container();
        // Accept both the native Azure blob URL and the CDN/custom-domain URL.
        String blobStoragePrefix = container.getBlobContainerUrl() + "/";
        String cdnPrefix = publicBaseUrl.isBlank() ? null
                : publicBaseUrl + "/" + container.getBlobContainerUrl()
                        .replaceFirst("^https?://[^/]+/", "") + "/";

        String blobName;
        if (blobUrl.startsWith(blobStoragePrefix)) {
            blobName = blobUrl.substring(blobStoragePrefix.length());
        } else if (cdnPrefix != null && blobUrl.startsWith(cdnPrefix)) {
            blobName = blobUrl.substring(cdnPrefix.length());
        } else {
            log.warn("blob delete skipped, url does not match container, url={}", blobUrl);
            return;
        }
        log.info("blob delete started, blobName={}", blobName);
        try {
            var blobClient = container.getBlobClient(blobName);
            boolean deleted = blobClient.deleteIfExists();
            log.info("blob delete completed, blobName={}, existed={}", blobName, deleted);
        } catch (BlobStorageException ex) {
            log.error("blob delete failed, blobName={}, statusCode={}", blobName, ex.getStatusCode(), ex);
            throw ex;
        }
    }
}
