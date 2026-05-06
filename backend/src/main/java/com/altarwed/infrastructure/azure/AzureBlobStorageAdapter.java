package com.altarwed.infrastructure.azure;

import com.altarwed.domain.port.BlobStoragePort;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobHttpHeaders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;

@Component
public class AzureBlobStorageAdapter implements BlobStoragePort {

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
        var blobClient = containerClient.getBlobClient(blobName);
        var headers = new BlobHttpHeaders().setContentType(contentType);
        blobClient.upload(data, length, true);
        blobClient.setHttpHeaders(headers);
        return blobClient.getBlobUrl();
    }

    @Override
    public void delete(String blobUrl) {
        // Extract blob name from full URL: everything after the container URL
        String prefix = containerClient.getBlobContainerUrl() + "/";
        if (blobUrl.startsWith(prefix)) {
            String blobName = blobUrl.substring(prefix.length());
            var blobClient = containerClient.getBlobClient(blobName);
            blobClient.deleteIfExists();
        }
    }
}
