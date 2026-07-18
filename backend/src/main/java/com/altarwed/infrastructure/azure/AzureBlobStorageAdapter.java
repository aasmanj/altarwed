package com.altarwed.infrastructure.azure;

import com.altarwed.domain.exception.StorageNotConfiguredException;
import com.altarwed.domain.port.BlobStoragePort;
import com.azure.core.util.BinaryData;
import com.azure.core.util.Context;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.models.BlobStorageException;
import com.azure.storage.blob.options.BlobParallelUploadOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Component
public class AzureBlobStorageAdapter implements BlobStoragePort {

    private static final Logger log = LoggerFactory.getLogger(AzureBlobStorageAdapter.class);

    // Blob names embed a fresh random UUID per upload ("{prefix}/{ownerId}/{UUID}.{ext}", see
    // MediaUploadService), so a given blob URL's bytes never change: replacing an image stores a
    // NEW blob name and the old one is deleted. That makes "immutable" correct and lets the CDN
    // (Cloudflare in front of media.altarwed.com, see infrastructure/docs DECISION-cdn-front-door)
    // and browsers cache for a full year without ever serving a stale image after a replace.
    static final String CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";

    // Longest Content-Disposition filename we will emit. Blob-derived names are UUID-based
    // (~41 chars), so this is a pure defensive bound, not a functional limit.
    private static final int MAX_DISPOSITION_FILENAME_LENGTH = 100;

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
                        throw new StorageNotConfiguredException(
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
            // Headers are set atomically in the SAME write (issue #75), not in a follow-up
            // setHttpHeaders() call. The old two-step left a window where the blob was live with
            // the default application/octet-stream Content-Type, which is exactly the sniffable
            // state a polyglot upload needs; it also cost a second round-trip and could leave a
            // permanently header-less blob if the process died between the two calls.
            var options = new BlobParallelUploadOptions(BinaryData.fromStream(data, length))
                    .setHeaders(buildHeaders(blobName, contentType));
            // No request conditions: overwrite allowed, same semantics as the previous
            // upload(data, length, true).
            blobClient.uploadWithResponse(options, null, Context.NONE);
            log.info("blob upload succeeded, blobName={}", blobName);
            String blobUrl = blobClient.getBlobUrl();
            if (!publicBaseUrl.isBlank()) {
                // Replace the Azure storage origin (https://{account}.blob.core.windows.net)
                // with the CDN/custom-domain origin, preserving the full path.
                int pathStart = blobUrl.indexOf('/', 8); // skip past "https://"
                blobUrl = publicBaseUrl + blobUrl.substring(pathStart);
            }
            return blobUrl;
        } catch (StorageNotConfiguredException ex) {
            // Known config degradation, not an unexpected error: WARN with context (not ERROR) so a
            // blank/rotated connection string disables uploads without paging on-call. The 503
            // mapping lives in GlobalExceptionHandler.
            log.warn("blob upload skipped, storage not configured, blobName={}", blobName);
            throw ex;
        } catch (BlobStorageException ex) {
            log.error("blob upload failed, blobName={}, statusCode={}", blobName, ex.getStatusCode(), ex);
            throw ex;
        }
    }

    // Builds the per-blob response headers stored with the blob and replayed by Azure on every GET
    // (issue #75, the polyglot / stored-XSS half of #35):
    //  - Content-Type: the caller-supplied type, which MediaUploadService derives from the file's
    //    magic bytes and requires to EQUAL the declared multipart type, so the stored type always
    //    matches the real bytes and is never the client's unverified claim.
    //  - Content-Disposition: inline, with a filename derived from OUR blob name (a server-generated
    //    UUID, never the client's original filename) and defensively sanitized. "inline" and not
    //    "attachment" because: (a) the blob origin (media.altarwed.com / *.blob.core.windows.net) is
    //    a separate cookieless host, so even a rendered payload has no app session to steal; (b) the
    //    strict image Content-Type plus nosniff at the CDN edge already stops HTML interpretation;
    //    (c) "attachment" would force-download photos that guests open in a new tab or that email
    //    clients fetch, breaking the product's core photo-viewing UX for no additional protection.
    //  - Cache-Control: immutable, safe because blob URLs are write-once (see CACHE_CONTROL_IMMUTABLE).
    // X-Content-Type-Options: nosniff intentionally does NOT appear here: BlobHttpHeaders has no
    // arbitrary-header hook and Azure Storage will not emit it per blob. It must be added at the
    // serving edge (Cloudflare response-header rule on media.altarwed.com, or a Front Door rules
    // engine); the manual step is documented in the PR for issue #75.
    // Package-private for tests.
    static BlobHttpHeaders buildHeaders(String blobName, String contentType) {
        return new BlobHttpHeaders()
                .setContentType(contentType)
                .setContentDisposition("inline; filename=\"" + dispositionFilename(blobName) + "\"")
                .setCacheControl(CACHE_CONTROL_IMMUTABLE);
    }

    // Reduces a blob name to a filename that is safe to embed in a quoted Content-Disposition
    // value. Today blob names are server-generated ("{prefix}/{uuid}/{uuid}.{ext}"), so this is
    // defense in depth for any future caller of BlobStoragePort: an allowlist (keep only
    // [A-Za-z0-9._-]) structurally removes header-injection characters (CR/LF), quote breakouts
    // ("), separators (; and ,), path bits (/ and \) and every other control or non-ASCII byte,
    // instead of trying to enumerate bad characters. Package-private for tests.
    static String dispositionFilename(String blobName) {
        String name = blobName == null ? "" : blobName;
        // Last path segment only: strip both separator styles before filtering.
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        StringBuilder safe = new StringBuilder(name.length());
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            boolean allowed = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
                    || (c >= '0' && c <= '9') || c == '.' || c == '_' || c == '-';
            if (allowed) {
                safe.append(c);
            }
        }
        // No leading dots: prevents hidden-file names and ".."-style relatives after filtering.
        int start = 0;
        while (start < safe.length() && safe.charAt(start) == '.') {
            start++;
        }
        String result = safe.substring(start);
        if (result.length() > MAX_DISPOSITION_FILENAME_LENGTH) {
            // Keep the tail so the ".ext" suffix survives truncation.
            result = result.substring(result.length() - MAX_DISPOSITION_FILENAME_LENGTH);
        }
        return result.isEmpty() ? "download" : result;
    }

    @Override
    public void delete(String blobUrl) {
        BlobContainerClient container;
        try {
            container = container();
        } catch (StorageNotConfiguredException ex) {
            // Same known-config-gap handling as upload: WARN (not ERROR), then let the 503
            // mapping in GlobalExceptionHandler translate it.
            log.warn("blob delete skipped, storage not configured");
            throw ex;
        }
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
        // getBlobUrl() returns a URL-encoded path (e.g. "hero%2Fuuid.jpg"). getBlobClient() takes a
        // plain blob name and re-encodes it, so passing the encoded form produces a double-encoded URL
        // ("hero%252Fuuid.jpg") that points to a non-existent blob. Decode first.
        // URLDecoder is form-decoding (+ -> space), not strict path-decoding. Safe here because
        // blob names are "{prefix}/{websiteId-UUID}/{UUID}.{ext}" -- no '+', '%', or spaces.
        String decodedBlobName = URLDecoder.decode(blobName, StandardCharsets.UTF_8);
        log.info("blob delete started, blobName={}", decodedBlobName);
        try {
            var blobClient = container.getBlobClient(decodedBlobName);
            boolean deleted = blobClient.deleteIfExists();
            log.info("blob delete completed, blobName={}, existed={}", decodedBlobName, deleted);
        } catch (BlobStorageException ex) {
            log.error("blob delete failed, blobName={}, statusCode={}", decodedBlobName, ex.getStatusCode(), ex);
            throw ex;
        }
    }
}
