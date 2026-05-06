package com.altarwed.domain.port;

import java.io.InputStream;

public interface BlobStoragePort {
    String upload(String containerPath, InputStream data, long length, String contentType);
    void delete(String blobUrl);
}
