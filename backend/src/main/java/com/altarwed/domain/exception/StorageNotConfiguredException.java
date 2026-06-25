package com.altarwed.domain.exception;

/**
 * Thrown when a blob/media operation is attempted while the storage backend is not configured
 * (AZURE_STORAGE_CONNECTION_STRING is blank or absent).
 *
 * <p>This is a known, recoverable-by-configuration degradation, NOT an unexpected error. By design
 * the app boots healthy with storage absent (see the env-var rules in backend/CLAUDE.md and
 * StartupConfigValidator) and only the media-upload feature is unavailable until the connection
 * string is set. It is mapped to 503 (not the catch-all 500) so this known config gap degrades the
 * feature without paging on-call as an ERROR.
 */
public class StorageNotConfiguredException extends RuntimeException {
    public StorageNotConfiguredException(String message) {
        super(message);
    }
}
