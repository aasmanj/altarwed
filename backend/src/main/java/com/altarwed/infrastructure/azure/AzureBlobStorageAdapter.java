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

    private final BlobContainerClient containerClient;

    public AzureBlobStorageAdapter(
            @Value("${altarwed.azure.storage.connection-string}") String connectionString,
            @Value("${altarwed.azure.storage.container-name}") String containerName
    ) {
        BlobServiceClient serviceClient = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .buildClient();
        this.containerClient = serviceClient.getBlobContainerClient(containerName);
        if (!this.containerClient.exists()) {
            this.containerClient.create();
        }
    }

    @Override
    public String upload(String blobName, InputStream data, long length, String contentType) {
        log.info("blob upload started, blobName={}, sizeBytes={}, contentType={}", blobName, length, contentType);
        try {
            var blobClient = containerClient.getBlobClient(blobName);
            var headers = new BlobHttpHeaders().setContentType(contentType);
            blobClient.upload(data, length, true);
            blobClient.setHttpHeaders(headers);
            log.info("blob upload succeeded, blobName={}", blobName);
            return blobClient.getBlobUrl();
        } catch (BlobStorageException ex) {
            log.error("blob upload failed, blobName={}, statusCode={}", blobName, ex.getStatusCode(), ex);
            throw ex;
        }
    }

    @Override
    public void delete(String blobUrl) {
        // Extract blob name from full URL: everything after the container URL
        String prefix = containerClient.getBlobContainerUrl() + "/";
        if (!blobUrl.startsWith(prefix)) {
            log.warn("blob delete skipped, url does not match container, prefix={}", prefix);
            return;
        }
        String blobName = blobUrl.substring(prefix.length());
        log.info("blob delete started, blobName={}", blobName);
        try {
            var blobClient = containerClient.getBlobClient(blobName);
            boolean deleted = blobClient.deleteIfExists();
            log.info("blob delete completed, blobName={}, existed={}", blobName, deleted);
        } catch (BlobStorageException ex) {
            log.error("blob delete failed, blobName={}, statusCode={}", blobName, ex.getStatusCode(), ex);
            throw ex;
        }
    }
}
